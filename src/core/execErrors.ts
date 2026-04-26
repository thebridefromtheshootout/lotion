// Shared helpers for interpreting Node child_process exec errors.

export function getExecErrorText(err: unknown): string {
  const e = err as { message?: unknown; stderr?: unknown; stdout?: unknown } | null | undefined;
  const pieces = [e?.message, e?.stderr, e?.stdout].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  return pieces.join("\n");
}

export function isMissingCommandError(err: unknown, command?: string): boolean {
  const text = getExecErrorText(err);
  const genericMissing =
    /command not found/i.test(text) ||
    /not found/i.test(text) ||
    /is not recognized as an internal or external command/i.test(text) ||
    /The term .* is not recognized/i.test(text) ||
    /ENOENT/i.test(text);
  if (!genericMissing) {
    return false;
  }
  if (!command) {
    return true;
  }
  return text.toLowerCase().includes(command.toLowerCase());
}
