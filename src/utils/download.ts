import * as url from "url";
import { https } from "follow-redirects";
import * as fs from "fs";

export async function fetchFromUrl(fullUrl: string): Promise<string> {
  const q = url.parse(fullUrl);
  return new Promise((resolve, reject) => {
    https
      .get(
        {
          host: q.hostname,
          path: q.pathname,
          port: q.port,
          headers: { "user-agent": "node.js" },
        },
        (res: any) => {
          let data = "";
          res.on("data", (chunk: any) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve(data);
          });
        }
      )
      .on("error", (err: any) => {
        console.error(`Error downloading file from ${url}: ${err.message}`);
        reject(err);
      });
  });
}

export async function downloadFromUrl(
  url: string,
  filePath: string
): Promise<void> {
  console.log("Downloading file from", url);
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode === 200) {
          const writeStream = fs.createWriteStream(filePath);
          response
            .on("end", () => {
              writeStream.close();
              console.log("file downloaded to", filePath);
              resolve();
            })
            .pipe(writeStream);
        } else {
          response.resume(); // Consume response to free up memory
          reject(new Error(response.statusMessage));
        }
      })
      .on("error", reject);
  });
}
