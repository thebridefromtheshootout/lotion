import { CodeLens, Disposable, EventEmitter, Range } from "../hostEditor/EditorTypes";
import type { CodeLensProvider, TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";

// ── CodeLens factory ───────────────────────────────────────────────
//
// Abstraction to reduce boilerplate when creating CodeLens providers.
// Two variants:
//   - createCodeLensProvider: simple stateless provider
//   - createStatefulCodeLensProvider: provider with refresh capability

/**
 * Signature for the function that generates CodeLenses for a document.
 */
export type CodeLensGenerator = (document: TextDocument) => CodeLens[];

/**
 * Create a simple stateless CodeLens provider for markdown files.
 *
 * @param generator Function that returns CodeLenses for a given document.
 * @returns A Disposable that unregisters the provider.
 */
export function createCodeLensProvider(generator: CodeLensGenerator): Disposable {
  return hostEditor.registerCodeLensProvider(
    { language: "markdown" },
    {
      provideCodeLenses(document: TextDocument): CodeLens[] {
        return generator(document);
      },
    },
  );
}

/**
 * Options for creating a stateful CodeLens provider.
 */
export interface StatefulCodeLensOptions {
  /** Function that returns CodeLenses for a given document. */
  generator: CodeLensGenerator;
  /** Events that should trigger a CodeLens refresh. */
  refreshOn?: {
    /** Refresh when any document is saved. */
    onSave?: boolean;
    /** Refresh when the active editor changes. */
    onEditorChange?: boolean;
  };
}

/**
 * Create a stateful CodeLens provider with automatic refresh capability.
 *
 * @param options Configuration for the provider.
 * @returns An object with the Disposable and a manual refresh() function.
 */
export function createStatefulCodeLensProvider(options: StatefulCodeLensOptions): {
  disposable: Disposable;
  refresh: () => void;
} {
  const emitter = new EventEmitter<void>();
  const disposables: Disposable[] = [];

  // Set up automatic refresh triggers
  if (options.refreshOn?.onSave) {
    disposables.push(hostEditor.onDidSaveTextDocument(() => emitter.fire()));
  }
  if (options.refreshOn?.onEditorChange) {
    hostEditor.onDidChangeActiveTextEditor(() => emitter.fire());
  }

  const provider: CodeLensProvider = {
    onDidChangeCodeLenses: emitter.event,
    provideCodeLenses(document: TextDocument): CodeLens[] {
      return options.generator(document);
    },
  };

  const registration = hostEditor.registerCodeLensProvider({ language: "markdown" }, provider);

  disposables.push(registration, emitter);

  return {
    disposable: Disposable.from(...disposables),
    refresh: () => emitter.fire(),
  };
}

/**
 * Helper to create a CodeLens with command.
 */
export function codeLens(
  line: number,
  title: string,
  command: string,
  args?: unknown[],
  options?: { startChar?: number; endChar?: number; tooltip?: string },
): CodeLens {
  const startChar = options?.startChar ?? 0;
  const endChar = options?.endChar ?? 0;
  const range = new Range(line, startChar, line, endChar);
  return new CodeLens(range, {
    title,
    command,
    arguments: args,
    tooltip: options?.tooltip,
  });
}
