import { fetchFromUrl } from "../utils/download";
import * as path from "path";
import * as fs from "fs";
import * as process from "process";

const artifactNameTemplates: any = {
  darwin: undefined,
  linux: "opengoal-lsp-linux-__VERSION__.bin",
  win32: "opengoal-lsp-windows-__VERSION__.exe",
};

const versionFileName = "lsp-metadata.json";

export function getLspReleaseAssetName(
  extensionPath: string,
  version: string,
  platform: string = process.platform
): string | undefined {
  if (!(platform in artifactNameTemplates)) {
    console.log(`Unsupported platform '${platform}'`);
    return undefined;
  }
  const nameTemplate = artifactNameTemplates[platform];
  if (nameTemplate === undefined) {
    console.log(`Unsupported platform '${platform}'`);
    return undefined;
  }

  return nameTemplate.replace("__VERSION__", version);
}

export async function getLatestVersion(): Promise<string> {
  try {
    const releasesJSON = await fetchFromUrl(
      "https://api.github.com/repos/open-goal/jak-project/releases"
    );
    const releases = JSON.parse(releasesJSON);
    return releases[0].tag_name;
  } catch (err) {
    return "";
  }
}

export function getVersionFromMetaFile(extensionPath: string): string {
  const filePath = path.join(extensionPath, versionFileName);
  try {
    const meta = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return meta.version;
  } catch (e: any) {
    console.log("Could not read lsp metadata version file.", e.message);
    return "";
  }
}

export function writeLspMetadata(extensionPath: string, version: string): void {
  const filePath = path.join(extensionPath, versionFileName);
  try {
    fs.writeFileSync(filePath, {
      version: version,
    });
  } catch (e: any) {
    console.log("Could not write lsp metadata file.", e.message);
  }
}
