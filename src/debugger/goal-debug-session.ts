import {
  ContinuedEvent,
  Handles,
  InitializedEvent,
  LoggingDebugSession,
  OutputEvent,
  Scope,
  Source,
  StackFrame,
  StoppedEvent,
  TerminatedEvent,
  Thread,
} from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import * as path from "path";
import {
  GoalDebugClient,
  InspectedField,
  RegisterInfo,
  RegistersResponse,
  StackFrameInfo,
  StoppedEventBody,
} from "./debug-client";

const GOAL_THREAD_ID = 1;

export interface GoalAttachArguments
  extends DebugProtocol.AttachRequestArguments {
  host?: string;
  port?: number | string;
  projectRoot?: string;
  stopOnEntry?: boolean;
}

type VariableContainer =
  | { kind: "locals" }
  | { kind: "special" }
  | { kind: "args" }
  | { kind: "general" }
  | { kind: "xmms" }
  | { kind: "xmm"; index: number }
  | { kind: "object"; ref: number };

export class GoalDebugSession extends LoggingDebugSession {
  private client = new GoalDebugClient();
  private variableHandles = new Handles<VariableContainer>();
  private projectRoot: string | undefined;
  private frames: StackFrameInfo[] = [];
  private registers: RegistersResponse | undefined;
  private connected = false;
  private stopOnEntry = true;
  private clientShowsVariableType = false;

  public constructor() {
    super("opengoal-debug.txt");
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(false);
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments,
  ): void {
    this.clientShowsVariableType = args.supportsVariableType === true;

    response.body = response.body ?? {};
    response.body.supportsConfigurationDoneRequest = true;
    response.body.supportsEvaluateForHovers = true;
    response.body.supportsStepInTargetsRequest = false;
    response.body.supportsRestartRequest = false;
    response.body.supportsTerminateRequest = true;
    response.body.supportsReadMemoryRequest = true;
    response.body.supportsExceptionInfoRequest = false;
    response.body.supportsStepBack = false;

    this.sendResponse(response);
  }

  protected async attachRequest(
    response: DebugProtocol.AttachResponse,
    args: GoalAttachArguments,
  ): Promise<void> {
    const host = args.host ?? "127.0.0.1";
    this.projectRoot = args.projectRoot;
    this.stopOnEntry = args.stopOnEntry ?? true;
    const port = Number(args.port ?? 8128);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      this.sendErrorResponse(
        response,
        1000,
        `'${args.port}' is not a valid debug server port.`,
      );
      return;
    }

    try {
      await this.client.connect(host, port);
      this.connected = true;
    } catch (err: any) {
      this.sendErrorResponse(response, 1001, err.message);
      return;
    }

    this.client.on("stopped", (body: StoppedEventBody) =>
      this.onTargetStopped(body),
    );
    this.client.on("continued", () => {
      this.invalidateStopState();
      this.sendEvent(new ContinuedEvent(GOAL_THREAD_ID));
    });
    this.client.on("terminated", () => this.sendEvent(new TerminatedEvent()));
    this.client.on("close", () => {
      if (this.connected) {
        this.connected = false;
        this.sendEvent(new TerminatedEvent());
      }
    });
    this.client.on("error", (err: Error) => {
      this.sendEvent(
        new OutputEvent(`[opengoal debug] ${err.message}\n`, "stderr"),
      );
    });

    try {
      const status = await this.client.status();
      if (!status.valid) {
        this.sendErrorResponse(
          response,
          1002,
          "goalc has no debug context. Connect to the running game first - `(lt)` in the REPL.",
        );
        return;
      }
      if (!status.attached) {
        await this.client.attach();
      }
    } catch (err: any) {
      this.sendErrorResponse(response, 1003, err.message);
      return;
    }

    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }

  protected async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: GoalAttachArguments,
  ): Promise<void> {
    return this.attachRequest(response, args);
  }

  protected async configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
    args: DebugProtocol.ConfigurationDoneArguments,
  ): Promise<void> {
    super.configurationDoneRequest(response, args);

    if (this.stopOnEntry) {
      await this.reportStopped("entry");
    } else {
      try {
        this.invalidateStopState();
        await this.client.continue();
      } catch (err: any) {
        this.sendEvent(
          new OutputEvent(`[opengoal debug] ${err.message}\n`, "stderr"),
        );
        await this.reportStopped("entry");
      }
    }
  }

  protected async setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments,
  ): Promise<void> {
    const file = args.source.path;
    const requested = args.breakpoints ?? [];

    if (file === undefined) {
      response.body = {
        breakpoints: requested.map(() => ({ verified: false })),
      };
      this.sendResponse(response);
      return;
    }

    try {
      const resolved = await this.client.setBreakpoints(
        file,
        requested.map((bp) => bp.line),
      );
      response.body = {
        breakpoints: resolved.map((bp) => ({
          verified: bp.verified,
          line: bp.line,
          message: bp.message,
        })),
      };
    } catch (err: any) {
      this.sendEvent(
        new OutputEvent(`[opengoal debug] ${err.message}\n`, "stderr"),
      );
      response.body = {
        breakpoints: requested.map(() => ({ verified: false })),
      };
    }

    this.sendResponse(response);
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = { threads: [new Thread(GOAL_THREAD_ID, "GOAL")] };
    this.sendResponse(response);
  }

  protected async stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    _args: DebugProtocol.StackTraceArguments,
  ): Promise<void> {
    try {
      this.frames = await this.client.stack();
    } catch (err: any) {
      this.sendErrorResponse(response, 2001, err.message);
      return;
    }

    response.body = {
      stackFrames: this.frames.map((frame) => {
        const source = this.sourceFor(frame.file);
        const stackFrame = new StackFrame(
          frame.id,
          `${frame.name} [${frame.object}]`,
          source,
          frame.line ?? 0,
          (frame.column ?? 0) + 1,
        );
        stackFrame.instructionPointerReference = `0x${frame.addr.toString(16)}`;
        return stackFrame;
      }),
      totalFrames: this.frames.length,
    };
    this.sendResponse(response);
  }

  protected scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments,
  ): void {
    const scopes: Scope[] = [];

    if (args.frameId === 0) {
      scopes.push(
        new Scope(
          "Locals",
          this.variableHandles.create({ kind: "locals" }),
          false,
        ),
      );
    }

    response.body = {
      scopes: [
        ...scopes,
        new Scope(
          "Special",
          this.variableHandles.create({ kind: "special" }),
          false,
        ),
        new Scope(
          "Arguments",
          this.variableHandles.create({ kind: "args" }),
          false,
        ),
        new Scope(
          "Registers",
          this.variableHandles.create({ kind: "general" }),
          true,
        ),
        new Scope(
          "SIMD Registers",
          this.variableHandles.create({ kind: "xmms" }),
          true,
        ),
      ],
    };
    this.sendResponse(response);
  }

  protected async variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
  ): Promise<void> {
    const container = this.variableHandles.get(args.variablesReference);
    if (container === undefined) {
      response.body = { variables: [] };
      this.sendResponse(response);
      return;
    }

    if (container.kind === "locals") {
      try {
        const locals = await this.client.locals();
        response.body = {
          variables: locals.map((local) => {
            const variable = this.formatField(local);
            variable.type = `${local.type}${local.parameter ? " (param)" : ""} in ${local.storage}`;
            return variable;
          }),
        };
        this.sendResponse(response);
      } catch (err: any) {
        this.sendErrorResponse(response, 2012, err.message);
      }
      return;
    }

    if (container.kind === "object") {
      try {
        const object = await this.client.inspectRef(container.ref);
        response.body = {
          variables: object.fields.map((f) => this.formatField(f)),
        };
        this.sendResponse(response);
      } catch (err: any) {
        this.sendErrorResponse(response, 2010, err.message);
      }
      return;
    }

    try {
      if (this.registers === undefined) {
        this.registers = await this.client.registers();
      }
    } catch (err: any) {
      this.sendErrorResponse(response, 2002, err.message);
      return;
    }

    const registers = this.registers;
    let variables: DebugProtocol.Variable[] = [];

    switch (container.kind) {
      case "special":
        variables = registers.special.map(formatRegister);
        variables.push({
          name: "rip",
          value: `${registers.rip}  (goal: 0x${registers.goalRip.toString(16)})`,
          variablesReference: 0,
        });
        break;

      case "args":
        variables = registers.args.map(formatRegister);
        break;

      case "general":
        variables = registers.general.map(formatRegister);
        break;

      case "xmms":
        variables = registers.xmms.map((xmm, index) => ({
          name: xmm.name,
          value: xmm.floats.map((f) => formatFloat(f)).join(", "),
          variablesReference: this.variableHandles.create({
            kind: "xmm",
            index,
          }),
        }));
        break;

      case "xmm": {
        const xmm = registers.xmms[container.index];
        if (xmm !== undefined) {
          variables = [
            ...xmm.floats.map((f, i) => ({
              name: ["x", "y", "z", "w"][i],
              value: formatFloat(f),
              variablesReference: 0,
            })),
            { name: "lo", value: xmm.lo, variablesReference: 0 },
            { name: "hi", value: xmm.hi, variablesReference: 0 },
          ];
        }
        break;
      }
    }

    response.body = { variables };
    this.sendResponse(response);
  }

  protected async evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments,
  ): Promise<void> {
    try {
      const result = await this.client.evaluate(args.expression);
      response.body = {
        result: result.result,
        type: result.objectType,
        variablesReference:
          result.ref === undefined
            ? 0
            : this.variableHandles.create({ kind: "object", ref: result.ref }),
      };
      if (result.addr !== undefined) {
        response.body.memoryReference = `0x${result.addr.toString(16)}`;
      }
      this.sendResponse(response);
    } catch (err: any) {
      if (args.context === "hover") {
        response.body = { result: "", variablesReference: 0 };
        this.sendResponse(response);
        return;
      }
      this.sendErrorResponse(response, 2003, err.message);
    }
  }

  protected async readMemoryRequest(
    response: DebugProtocol.ReadMemoryResponse,
    args: DebugProtocol.ReadMemoryArguments,
  ): Promise<void> {
    try {
      const addr = parseInt(args.memoryReference, 16) + (args.offset ?? 0);
      const result = await this.client.readMemory(addr, args.count);
      response.body = {
        address: `0x${result.addr.toString(16)}`,
        data: Buffer.from(result.data, "hex").toString("base64"),
      };
      this.sendResponse(response);
    } catch (err: any) {
      this.sendErrorResponse(response, 2004, err.message);
    }
  }

  protected async continueRequest(
    response: DebugProtocol.ContinueResponse,
    _args: DebugProtocol.ContinueArguments,
  ): Promise<void> {
    try {
      this.invalidateStopState();
      await this.client.continue();
      this.sendResponse(response);
    } catch (err: any) {
      this.sendErrorResponse(response, 2005, err.message);
    }
  }

  protected async pauseRequest(
    response: DebugProtocol.PauseResponse,
    _args: DebugProtocol.PauseArguments,
  ): Promise<void> {
    try {
      await this.client.pause();
      this.sendResponse(response);
      await this.reportStopped("pause");
    } catch (err: any) {
      this.sendErrorResponse(response, 2006, err.message);
    }
  }

  protected async nextRequest(
    response: DebugProtocol.NextResponse,
    _args: DebugProtocol.NextArguments,
  ): Promise<void> {
    await this.doStep(response, "over", 2007);
  }

  protected async stepInRequest(
    response: DebugProtocol.StepInResponse,
    _args: DebugProtocol.StepInArguments,
  ): Promise<void> {
    await this.doStep(response, "in", 2008);
  }

  protected async stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    _args: DebugProtocol.StepOutArguments,
  ): Promise<void> {
    await this.doStep(response, "out", 2009);
  }

  private async doStep(
    response: DebugProtocol.Response,
    kind: "over" | "in" | "out",
    errorId: number,
  ): Promise<void> {
    try {
      this.invalidateStopState();
      await this.client.step(kind);
      this.sendResponse(response);
    } catch (err: any) {
      this.sendErrorResponse(response, errorId, err.message);
    }
  }

  protected async disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    _args: DebugProtocol.DisconnectArguments,
  ): Promise<void> {
    this.connected = false;
    try {
      await this.client.detach();
    } catch {}
    this.client.dispose();
    this.sendResponse(response);
  }

  protected async terminateRequest(
    response: DebugProtocol.TerminateResponse,
    _args: DebugProtocol.TerminateArguments,
  ): Promise<void> {
    this.sendResponse(response);
    this.sendEvent(new TerminatedEvent());
  }

  private formatField(field: InspectedField): DebugProtocol.Variable {
    let placement = "";
    if (field.bitOffset !== undefined && field.bitSize !== undefined) {
      const last = field.bitOffset + field.bitSize - 1;
      placement = ` @ bit ${field.bitOffset}${field.bitSize > 1 ? `..${last}` : ""}`;
    } else if (field.offset !== undefined) {
      placement = ` @ ${field.offset}`;
    }

    const parts = [field.value];
    if (field.type.length > 0 && !field.value.startsWith(`(${field.type}`)) {
      // remove extra parens from compound types like "(pointer process)"
      parts.push(field.type.startsWith("(") ? field.type : `(${field.type})`);
    }
    if (field.inline) {
      parts.push("(inline)");
    }
    let value = parts.join(" ");
    if (!this.clientShowsVariableType) {
      value += placement;
    }
    if (field.units !== undefined && field.units.length > 0) {
      value += "\n" + field.units.map((unit) => `  ${unit}`).join("\n");
    }

    return {
      name: field.name,
      value,
      type: field.type + placement,
      variablesReference:
        field.ref === undefined
          ? 0
          : this.variableHandles.create({ kind: "object", ref: field.ref }),
    };
  }

  private onTargetStopped(body: StoppedEventBody) {
    this.invalidateStopState();
    this.sendEvent(
      new StoppedEvent(mapStopReason(body.reason), GOAL_THREAD_ID, body.reason),
    );
  }

  private async reportStopped(reason: string) {
    this.invalidateStopState();
    this.sendEvent(new StoppedEvent(reason, GOAL_THREAD_ID));
  }

  private invalidateStopState() {
    this.registers = undefined;
    this.frames = [];
    this.variableHandles.reset();
  }

  private sourceFor(file: string | undefined): Source | undefined {
    if (file === undefined) {
      return undefined;
    }
    const absolute =
      path.isAbsolute(file) || this.projectRoot === undefined
        ? file
        : path.join(this.projectRoot, file);
    return new Source(path.basename(absolute), absolute);
  }
}

export function formatRegister(reg: RegisterInfo): DebugProtocol.Variable {
  const notes = [reg.role];
  if (reg.detail !== undefined) {
    notes.push(reg.detail);
  }

  const variable: DebugProtocol.Variable = {
    name: reg.label,
    value: `${reg.value}  (${notes.join(", ")})`,
    variablesReference: 0,
  };

  if (reg.goalValue !== undefined) {
    variable.memoryReference = `0x${reg.goalValue.toString(16)}`;
  }
  return variable;
}

function formatFloat(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  if (Number.isInteger(value)) {
    return value.toFixed(1);
  }
  return value.toPrecision(7).replace(/0+$/, "");
}

function mapStopReason(reason: string): string {
  switch (reason) {
    case "breakpoint":
      return "breakpoint";
    case "step":
      return "step";
    case "segfault":
    case "math exception":
    case "illegal instruction":
      return "exception";
    default:
      return reason;
  }
}
