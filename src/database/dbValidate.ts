// Re-export the shared validator from contracts so extension-side code
// keeps its existing `./dbValidate` import path while the same logic is
// also available to the webview (which can't reach into src/database/).

export { validateColumnValue, validateUniqueness, validateEntry } from "../contracts/dbValidate";
export type { ValidationViolation } from "../contracts/dbValidate";
