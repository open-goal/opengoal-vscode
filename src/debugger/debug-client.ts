import { Socket } from "net";
import { EventEmitter } from "events";

/**
 * Client for the REPL debug server.
 */

export interface StackFrameInfo {
  id: number;
  name: string;
  object: string;
  addr: number;
  rsp: string;
  file?: string;
  line?: number;
  column?: number;
  lineText?: string;
}

export interface ResolvedBreakpoint {
  line: number;
  verified: boolean;
  addr?: number;
  function?: string;
  object?: string;
  message?: string;
}

export interface RegisterInfo {
  name: string;
  label: string;
  role: string;
  group: "special" | "arg" | "general";
  value: string;
  goalValue?: number;
  detail?: string;
}

export interface XmmInfo {
  name: string;
  floats: number[];
  lo: string;
  hi: string;
}

export interface RegistersResponse {
  special: RegisterInfo[];
  args: RegisterInfo[];
  general: RegisterInfo[];
  gprs: RegisterInfo[];
  xmms: XmmInfo[];
  rip: string;
  goalRip: number;
}

export interface DebuggerStatus {
  valid: boolean;
  attached: boolean;
  halted: boolean;
  running: boolean;
}

export interface InspectedField {
  name: string;
  type: string;
  value: string;
  offset?: number;
  bitOffset?: number;
  bitSize?: number;
  function?: string;
  units?: string[];
  inline?: boolean;
  ref?: number;
}

export interface LocalVariable extends InspectedField {
  parameter: boolean;
  storage: string;
}

export interface InspectedObject {
  addr: number;
  type: string;
  summary?: string;
  fields: InspectedField[];
}

export interface EvaluateResult {
  result: string;
  kind: string;
  addr?: number;
  info?: string;
  objectType?: string;
  ref?: number;
}

export interface StoppedEventBody {
  reason: string;
  addr?: number;
  file?: string;
  line?: number;
  column?: number;
}

interface PendingRequest {
  resolve: (body: any) => void;
  reject: (err: Error) => void;
}

export class GoalDebugClient extends EventEmitter {
  private socket: Socket | undefined;
  private buffer = "";
  private nextSeq = 1;
  private pending = new Map<number, PendingRequest>();
  private closed = false;

  async connect(host: string, port: number, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      this.socket = socket;
      socket.setEncoding("utf8");

      const onError = (err: Error) => {
        socket.destroy();
        reject(
          new Error(
            `Could not connect to the OpenGOAL debug server at ${host}:${port} - ${err.message}. ` +
              `Is goalc running with a debug server on that port?`,
          ),
        );
      };

      socket.once("error", onError);
      socket.setTimeout(timeoutMs, () =>
        onError(new Error("connection timed out")),
      );

      socket.connect(port, host, () => {
        socket.setTimeout(0);
        socket.removeListener("error", onError);
        socket.on("error", (err) => this.emit("error", err));
        socket.on("data", (chunk: string) => this.onData(chunk));
        socket.on("close", () => {
          this.closed = true;
          for (const [, req] of this.pending) {
            req.reject(new Error("the debug connection was closed"));
          }
          this.pending.clear();
          this.emit("close");
        });
        resolve();
      });
    });
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    let newline: number;
    while ((newline = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (line.trim().length === 0) {
        continue;
      }
      this.handleMessage(line);
    }
  }

  private handleMessage(line: string) {
    let message: any;
    try {
      message = JSON.parse(line);
    } catch (err) {
      this.emit(
        "error",
        new Error(`malformed message from the debug server: ${line}`),
      );
      return;
    }

    if (message.event !== undefined) {
      this.emit(message.event, message.body ?? {});
      return;
    }

    const req = this.pending.get(message.seq);
    if (req === undefined) {
      return;
    }
    this.pending.delete(message.seq);

    if (message.ok) {
      req.resolve(message.body ?? {});
    } else {
      req.reject(
        new Error(
          message.error ?? "the debug server reported an unknown failure",
        ),
      );
    }
  }

  private send(cmd: string, args: Record<string, unknown> = {}): Promise<any> {
    if (this.socket === undefined || this.closed) {
      return Promise.reject(new Error("not connected to the debug server"));
    }
    const seq = this.nextSeq++;
    return new Promise((resolve, reject) => {
      this.pending.set(seq, { resolve, reject });
      this.socket!.write(JSON.stringify({ seq, cmd, args }) + "\n", (err) => {
        if (err) {
          this.pending.delete(seq);
          reject(err);
        }
      });
    });
  }

  status(): Promise<DebuggerStatus> {
    return this.send("status");
  }

  attach(): Promise<DebuggerStatus> {
    return this.send("attach");
  }

  detach(): Promise<DebuggerStatus> {
    return this.send("detach");
  }

  pause(): Promise<DebuggerStatus> {
    return this.send("pause");
  }

  continue(): Promise<DebuggerStatus> {
    return this.send("continue");
  }

  step(kind: "over" | "in" | "out"): Promise<DebuggerStatus> {
    return this.send("step", { kind });
  }

  async setBreakpoints(
    file: string,
    lines: number[],
  ): Promise<ResolvedBreakpoint[]> {
    const body = await this.send("set-breakpoints", { file, lines });
    return body.breakpoints ?? [];
  }

  async stack(): Promise<StackFrameInfo[]> {
    const body = await this.send("stack");
    return body.frames ?? [];
  }

  registers(): Promise<RegistersResponse> {
    return this.send("registers");
  }

  readMemory(
    addr: number,
    size: number,
  ): Promise<{ addr: number; size: number; data: string }> {
    return this.send("read-memory", { addr, size });
  }

  evaluate(expr: string): Promise<EvaluateResult> {
    return this.send("evaluate", { expr });
  }

  async locals(): Promise<LocalVariable[]> {
    const body = await this.send("locals");
    return body.variables ?? [];
  }

  inspectRef(ref: number): Promise<InspectedObject> {
    return this.send("inspect", { ref });
  }

  inspectAddr(addr: number, type?: string): Promise<InspectedObject> {
    return this.send("inspect", type === undefined ? { addr } : { addr, type });
  }

  dispose() {
    this.closed = true;
    this.socket?.destroy();
    this.socket = undefined;
  }
}
