import { ConfigurationTarget, Position, ProgressLocation, Range, Uri, ViewColumn } from "../../hostEditor/EditorTypes";
import type { TextDocument, WebviewPanel } from "../../hostEditor/EditorTypes";
import { hostEditor } from "../../hostEditor/HostingEditor";
import { ExtensionToGifPanelCommunicator } from "../../communicators/gifPanelCommunicator";
import * as path from "path";
import * as fs from "fs";
import { getCwd } from "../../core/cwd";
import { Cmd } from "../../core/commands";
import { Regex } from "../../core/regex";
import type { SlashCommand } from "../../core/slashCommands";
import { downloadToFile } from "./gifDownload";
import { searchGifs } from "./gifSearch";
import { GifItem, GifProvider, GifProviderPick, GIF_PROVIDER_INFO } from "./gifTypes";

export const GIF_SLASH_COMMAND: SlashCommand = {
  label: "/gif",
  insertText: "",
  detail: "🎬 Search for a GIF",
  isAction: true,
  commandId: Cmd.insertGif,
  kind: 16,
  handler: handleGifCommand,
};

async function ensureGifProvider(): Promise<GifProvider | undefined> {
  const config = hostEditor.getConfiguration("lotion");
  let provider = config.get<string>("gifProvider", "") as GifProvider | "";

  if (!provider) {
    const picked = await hostEditor.showQuickPick<GifProviderPick>(
      [
        { label: "Giphy", description: "giphy.com", provider: "giphy" },
        { label: "Klipy", description: "klipy.com", provider: "klipy" },
      ],
      { placeHolder: "Choose a GIF provider" },
    );
    if (!picked) {
      return undefined;
    }
    provider = picked.provider;
    await config.update("gifProvider", provider, ConfigurationTarget.Global);
  }

  return provider;
}

async function ensureGifApiKey(provider: GifProvider): Promise<string | undefined> {
  const config = hostEditor.getConfiguration("lotion");
  const info = GIF_PROVIDER_INFO[provider];

  let apiKey = config.get<string>(info.apiKeySettingKey, "");
  if (apiKey) {
    return apiKey;
  }

  const action = await hostEditor.showInformationMessage(
    `Lotion: A ${info.label} API key is required for GIF search. Get one at ${info.signupUrl}`,
    ["Open Signup Page", "I Have a Key"],
  );
  if (action === "Open Signup Page") {
    hostEditor.openExternal(Uri.parse(info.signupUrl));
  }

  const entered = await hostEditor.showInputBox({
    prompt: `Enter your ${info.label} API key`,
    placeHolder: "Paste API key here",
    ignoreFocusOut: true,
  });
  if (!entered) {
    return undefined;
  }

  apiKey = entered;
  await config.update(info.apiKeySettingKey, apiKey, ConfigurationTarget.Global);
  return apiKey;
}

async function pickGif(provider: GifProvider, apiKey: string): Promise<GifItem | undefined> {
  const qp = hostEditor.createQuickPick<GifItem>();
  qp.placeholder = "Search for a GIF…";
  qp.matchOnDescription = false;

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
        qp.items = await searchGifs(provider, query, apiKey);
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

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  previewPanel?.dispose();

  return pick;
}

export async function handleGifCommand(document: TextDocument, position: Position): Promise<void> {
  const provider = await ensureGifProvider();
  if (!provider) {
    return;
  }

  const apiKey = await ensureGifApiKey(provider);
  if (!apiKey) {
    return;
  }

  const cwd = getCwd();
  if (!cwd) {
    hostEditor.showError("Lotion: no active file directory.");
    return;
  }

  const pick = await pickGif(provider, apiKey);
  if (!pick) {
    return;
  }

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

  const alt = (pick.label || "gif").replace(Regex.doubleQuote, "&quot;");
  const triggerRange = new Range(position.translate(0, -1), position);
  await hostEditor.replaceRange(triggerRange, `<img src=".rsrc/${safeName}.gif" alt="${alt}">`);
}
