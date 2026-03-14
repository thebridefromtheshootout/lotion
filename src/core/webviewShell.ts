
import { Uri } from "../hostEditor/EditorTypes";
import type { Webview } from "../hostEditor/EditorTypes";
import { Regex } from "./regex";

let _extensionUri: Uri | undefined;

/**
 * Call once during extension activation to set the extension URI.
 */
export function initWebviewShell(extensionUri: Uri): void {
  _extensionUri = extensionUri;
}

/**
 * Get the stored extension URI (throws if not initialised).
 */
export function getExtensionUri(): Uri {
  if (!_extensionUri) throw new Error("webviewShell not initialised — call initWebviewShell first");
  return _extensionUri;
}

/**
 * Generate a random nonce for CSP script tags.
 */
export function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 16; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function escapeHtml(s: string): string {
  return s
    .replace(Regex.htmlEscapeAmp, "&amp;")
    .replace(Regex.htmlEscapeLt, "&lt;")
    .replace(Regex.htmlEscapeGt, "&gt;")
    .replace(Regex.htmlEscapeQuote, "&quot;");
}

export interface ShellOptions {
  webview: Webview;
  /** Name of the app entry point (e.g. "dictateApp"). Used to resolve out/webview/<name>.js and .css */
  appName: string;
  title: string;
  /** Extra CSP directives to append (e.g. "media-src blob:"). */
  extraCsp?: string[];
}

/**
 * Build the minimal shell HTML that loads a React app from out/webview/.
 * Every webview in the extension reuses this pattern.
 */
export function getWebviewShellHtml(opts: ShellOptions): string {
  const { webview, appName, title, extraCsp } = opts;
  const extensionUri = getExtensionUri();
  const nonce = getNonce();
  const scriptUri = webview.asWebviewUri(Uri.joinPath(extensionUri, "out", "webview", `${appName}.js`));
  const styleUri = webview.asWebviewUri(Uri.joinPath(extensionUri, "out", "webview", `${appName}.css`));

  const cspParts = [
    "default-src 'none'",
    `script-src ${webview.cspSource} 'nonce-${nonce}'`,
    `style-src 'unsafe-inline' ${webview.cspSource}`,
    `img-src ${webview.cspSource} https:`,
    `font-src ${webview.cspSource}`,
    ...(extraCsp ?? []),
  ];
  const csp = cspParts.join("; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${styleUri}" />
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
