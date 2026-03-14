import * as https from "https";
import type { GifItem, GifProvider, GiphyResponse, KlipyResponse } from "./gifTypes";

function searchGiphy(query: string, apiKey: string): Promise<GifItem[]> {
  return new Promise((resolve, reject) => {
    const url =
      `https://api.giphy.com/v1/gifs/search` +
      `?api_key=${encodeURIComponent(apiKey)}` +
      `&q=${encodeURIComponent(query)}` +
      `&limit=25&rating=g`;

    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () => {
          try {
            const json: GiphyResponse = JSON.parse(data);
            resolve(
              json.data.map((g) => ({
                label: g.title || g.id,
                description: "giphy.com",
                downloadUrl: g.images.downsized?.url || g.images.original.url,
                previewUrl: g.images.fixed_height?.url || g.images.downsized?.url || g.images.original.url,
                gifId: g.id,
              })),
            );
          } catch (err) {
            reject(err);
          }
        });
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function searchKlipy(query: string, apiKey: string): Promise<GifItem[]> {
  return new Promise((resolve, reject) => {
    const url =
      `https://api.klipy.com/api/v1/${encodeURIComponent(apiKey)}/gifs/search` +
      `?q=${encodeURIComponent(query)}` +
      `&per_page=25&content_filter=high`;

    https
      .get(url, { headers: { "Content-Type": "application/json" } }, (res) => {
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () => {
          try {
            const json: KlipyResponse = JSON.parse(data);
            if (!json.result || !json.data?.data) {
              resolve([]);
              return;
            }
            resolve(
              json.data.data
                .filter((g) => g.file?.md?.gif?.url || g.file?.hd?.gif?.url)
                .map((g) => ({
                  label: g.title || g.slug || String(g.id),
                  description: "klipy.com",
                  downloadUrl: g.file.md?.gif?.url || g.file.hd?.gif?.url || "",
                  previewUrl: g.file.sm?.gif?.url || g.file.md?.gif?.url || g.file.hd?.gif?.url || "",
                  gifId: String(g.id),
                })),
            );
          } catch (err) {
            reject(err);
          }
        });
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

export function searchGifs(provider: GifProvider, query: string, apiKey: string): Promise<GifItem[]> {
  return provider === "klipy" ? searchKlipy(query, apiKey) : searchGiphy(query, apiKey);
}
