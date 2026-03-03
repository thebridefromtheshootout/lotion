// ── CodeLens generators registry ────────────────────────────────────
// Stateless CodeLens generators that can be registered with createCodeLensProvider

import { generateDbLenses } from "../database";
import { generateGraphLenses } from "../media";
import { generateDateLenses, generateProcessorLenses } from "../editor";
import type { CodeLensGenerator } from "./codeLens";

/**
 * Array of stateless CodeLens generator functions.
 * Each is registered via createCodeLensProvider(generator).
 */
export const CODELENS_GENERATORS: CodeLensGenerator[] = [
  generateGraphLenses,
  generateDbLenses,
  generateDateLenses,
  generateProcessorLenses,
];
