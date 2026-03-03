import { ConfigurationTarget, Position, ProgressLocation, Range, Uri, ViewColumn } from "../hostEditor/EditorTypes";
import type { QuickPickItem, TextDocument, WebviewPanel } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { ExtensionToGifPanelCommunicator } from "../communicators/gifPanelCommunicator";
import * as https from "https";
import * as http from "http";
import * as path from "path";
import * as fs from "fs";
import { getCwd } from "../core/cwd";
import { getExtensionUri, getWebviewShellHtml } from "../core/webviewShell";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

export const GIF_SLASH_COMMAND: SlashCommand = {
  label: "/gif",
  insertText: "",
  detail: "🎬 Search for a GIF",
  isAction: true,
  commandId: Cmd.insertGif,
  kind: 16,
  handler: handleGifCommand,
};

// ── Giphy API ──────────────────────────────────────────────────────

interface GiphyGif {
  id: string;
  title: string;
  images: {
    original: { url: string };
    downsized: { url: string };
    fixed_height: { url: string };
  };
}
interface GiphyResponse {
  data: GiphyGif[];
}

interface GifItem extends QuickPickItem {
  downloadUrl: string;
  previewUrl: string;
  gifId: string;
}

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

// ── Klipy API ──────────────────────────────────────────────────────

interface KlipyMediaVariant {
  url: string;
  width: number;
  height: number;
  size: number;
}
interface KlipySizeTier {
  gif?: KlipyMediaVariant;
  webp?: KlipyMediaVariant;
  jpg?: KlipyMediaVariant;
  mp4?: KlipyMediaVariant;
}
interface KlipyGif {
  id: number;
  slug: string;
  title?: string;
  file: {
    hd?: KlipySizeTier;
    md?: KlipySizeTier;
    sm?: KlipySizeTier;
    xs?: KlipySizeTier;
  };
}
interface KlipyResponse {
  result: boolean;
  data: { data: KlipyGif[] };
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

type GifProvider = "giphy" | "klipy";

const PROVIDER_INFO: Record<GifProvider, { label: string; apiKeySettingKey: string; signupUrl: string }> = {
  giphy: {
    label: "Giphy",
    apiKeySettingKey: "giphyApiKey",
    signupUrl: "https://developers.giphy.com/",
  },
  klipy: {
    label: "Klipy",
    apiKeySettingKey: "klipyApiKey",
    signupUrl: "https://developer.klipy.com/",
  },
};

// ── Minimal HTTP(S) download with redirect support ─────────────────

function downloadToFile(url: URL, destPath: string, redirects = 5): Promise<void> {
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

// ── /gif handler ───────────────────────────────────────────────────

export async function handleGifCommand(document: TextDocument, position: Position): Promise<void> {
  const config = hostEditor.getConfiguration("lotion");

  // ── 1. Ensure a provider is selected ────────────────────────────
  let provider = config.get<string>("gifProvider", "") as GifProvider | "";
  if (!provider) {
    const picked = await hostEditor.showQuickPick(
      [
        { label: "Giphy", description: "giphy.com", provider: "giphy" as const },
        { label: "Klipy", description: "klipy.com", provider: "klipy" as const },
      ],
      { placeHolder: "Choose a GIF provider" },
    );
    if (!picked) {
      return;
    }
    provider = (picked as any).provider as GifProvider;
    await config.update("gifProvider", provider, ConfigurationTarget.Global);
  }

  const info = PROVIDER_INFO[provider];

  // ── 2. Ensure an API key exists for the chosen provider ─────────
  let apiKey = config.get<string>(info.apiKeySettingKey, "");
  if (!apiKey) {
    const action = await hostEditor.showInformationMessage(
      `Lotion: A ${info.label} API key is required for GIF search. Get one at ${info.signupUrl}`,
      ["Open Signup Page", "I Have a Key"],
    );
    if (action === "Open Signup Page") {
      hostEditor.openExternal(Uri.parse(info.signupUrl));
    }
    // Whether they opened the link or already have a key, ask for it
    const entered = await hostEditor.showInputBox({
      prompt: `Enter your ${info.label} API key`,
      placeHolder: "Paste API key here",
      ignoreFocusOut: true,
    });
    if (!entered) {
      return;
    }
    apiKey = entered;
    await config.update(info.apiKeySettingKey, apiKey, ConfigurationTarget.Global);
  }

  const cwd = getCwd();
  if (!cwd) {
    hostEditor.showError("Lotion: no active file directory.");
    return;
  }

  const qp = hostEditor.createQuickPick<GifItem>();
  qp.placeholder = "Search for a GIF…";
  qp.matchOnDescription = false;

  // ── Preview webview (opens beside the editor) ──────────────────
  let previewPanel: WebviewPanel | undefined;
  let communicator: ExtensionToGifPanelCommunicator | undefined;

  function ensurePanel(): { panel: WebviewPanel; comm: ExtensionToGifPanelCommunicator } {
    if (previewPanel && communicator) {
      return { panel: previewPanel, comm: communicator };
    }
    previewPanel = hostEditor.createWebviewPanel(
      "lotionGifPreview",
      "GIF Preview",
      "gifApp",
      { viewColumn: ViewColumn.Beside, preserveFocus: true },
      { extraCsp: ["img-src * data:"] },
    );
    communicator = new ExtensionToGifPanelCommunicator(previewPanel.webview);

    previewPanel.onDidDispose(() => {
      previewPanel = undefined;
      communicator = undefined;
    });
    return { panel: previewPanel, comm: communicator };
  }

  function updatePreview(item: GifItem) {
    const { comm } = ensurePanel();
    comm.sendPreview({
      url: item.previewUrl,
      title: item.label || "",
    });
  }

  // Update preview when user navigates with arrow keys
  qp.onDidChangeActive((items) => {
    if (items.length > 0) {
      updatePreview(items[0]);
    }
  });

  let debounceTimer: NodeJS.Timeout | undefined;

  qp.onDidChangeValue((query) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (!query.trim()) {
      qp.items = [];
      return;
    }
    qp.busy = true;
    debounceTimer = setTimeout(async () => {
      try {
        const items = provider === "klipy"
          ? await searchKlipy(query, apiKey)
          : await searchGiphy(query, apiKey);
        qp.items = items;
      } catch {
        qp.items = [];
      }
      qp.busy = false;
    }, 400);
  });

  const pick = await new Promise<GifItem | undefined>((resolve) => {
    qp.onDidAccept(() => {
      resolve(qp.selectedItems[0]);
      qp.dispose();
    });
    qp.onDidHide(() => {
      resolve(undefined);
      qp.dispose();
    });
    qp.show();
  });

  // Always dispose the preview panel when done
  previewPanel?.dispose();

  if (!pick) {
    return;
  }

  // Ensure .rsrc/ exists
  const rsrcDir = path.join(cwd, ".rsrc");
  if (!fs.existsSync(rsrcDir)) {
    fs.mkdirSync(rsrcDir, { recursive: true });
  }

  const safeName = pick.gifId;
  const destPath = path.join(rsrcDir, `${safeName}.gif`);

  try {
    await hostEditor.withProgress(
      {
        location: ProgressLocation.Notification,
        title: "Downloading GIF…",
      },
      () => downloadToFile(new URL(pick.downloadUrl), destPath),
    );
  } catch (err: any) {
    hostEditor.showError(`Lotion: Failed to download GIF — ${err.message}`);
    return;
  }

  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }

  const alt = (pick.label || "gif").replace(/[[\]]/g, "");
  const triggerRange = new Range(position.translate(0, -1), position);
  await hostEditor.replaceRange(triggerRange, `![${alt}](.rsrc/${safeName}.gif)`);
}
