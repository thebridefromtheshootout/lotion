import * as https from "https";
import * as http from "http";
import * as fs from "fs";

export function downloadToFile(url: URL, destPath: string, redirects = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redirects <= 0) {
      return reject(new Error("Too many redirects"));
    }

    const lib = url.protocol === "https:" ? https : http;

    lib
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, url);
          res.resume();
          return downloadToFile(next, destPath, redirects - 1).then(resolve, reject);
        }

        if (!res.statusCode || res.statusCode >= 400) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on("finish", () => fileStream.close(() => resolve()));
        fileStream.on("error", (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      })
      .on("error", reject);
  });
}
