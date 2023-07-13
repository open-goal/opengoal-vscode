import { getLspReleaseAssetName, writeLspMetadata } from "./util";
import * as path from "path";
import * as fs from "fs";
import { downloadFromUrl } from "../utils/download";

export async function downloadLsp(
  extensionPath: string,
  version: string,
): Promise<string | undefined> {
  const assetName = getLspReleaseAssetName(version);
  if (assetName === undefined) {
    return undefined;
  }
  const url = `https://github.com/open-goal/jak-project/releases/download/${version}/${assetName}`;
  const savePath = path.join(extensionPath, assetName);
  try {
    await downloadFromUrl(url, savePath);
    if (path.extname(savePath) === ".bin") {
      fs.chmodSync(savePath, 0o775);
    }
    writeLspMetadata(extensionPath, version);
  } catch (e: any) {
    console.log("Error downloading opengoal-lsp", e);
    // TODO - backup existing and return that path
    return;
  }
  return savePath;
}
