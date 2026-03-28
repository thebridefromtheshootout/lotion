// ── Tiny date formatter (no deps) ─────────────────────────────────
import { Regex } from "../../core/regex";
import { MONTH_NAMES, DAY_NAMES } from "../../core/dateNames";

export function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

export function formatDate(d: Date, fmt: string): string {
  const YYYY = String(d.getFullYear());
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const D = String(d.getDate());
  const MMMM = MONTH_NAMES[d.getMonth()];
  const ddd = DAY_NAMES[d.getDay()];
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());

  return fmt
    .replace("YYYY", YYYY)
    .replace("MMMM", MMMM)
    .replace("MM", MM)
    .replace("DD", DD)
    .replace(Regex.dateTokenSingleD, D)
    .replace("ddd", ddd)
    .replace("HH", HH)
    .replace("mm", mm);
}

export const FORMAT_KEYS = [
  "YYYY-MM-DD",
  "MM/DD/YYYY",
  "DD/MM/YYYY",
  "MMMM D, YYYY",
  "D MMMM YYYY",
  "ddd, MMMM D, YYYY",
  "YYYY-MM-DD HH:mm",
] as const;
