import { Regex } from "./regex";

export function toKebabCaseLower(text: string): string {
  return text.toLowerCase().replace(Regex.whitespaceRun, "-");
}

export function toPathSlug(text: string): string {
  return toKebabCaseLower(text).replace(Regex.slugUnsafeChars, "");
}

export function toHeadingSlug(text: string): string {
  return toKebabCaseLower(text.replace(Regex.nonWordSpaceHyphen, "")).replace(Regex.trimHyphenEdges, "");
}
