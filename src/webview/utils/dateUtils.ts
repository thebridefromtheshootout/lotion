import { Regex } from "../../core/regex";

// ── Constants ──────────────────────────────────────────────────────

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const FORMAT_KEYS = [
  "YYYY-MM-DD",
  "MM/DD/YYYY",
  "DD/MM/YYYY",
  "MMMM D, YYYY",
  "D MMMM YYYY",
  "ddd, MMMM D, YYYY",
  "YYYY-MM-DD HH:mm",
];

// ── Format / parse ─────────────────────────────────────────────────

export function pad(n: number): string {
  return n < 10 ? "0" + n : "" + n;
}

export function formatDate(d: Date, fmt: string): string {
  const YYYY = "" + d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const D = "" + d.getDate();
  const MMMM = MONTHS[d.getMonth()];
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

/** Try to parse a date string in common formats. Returns null on failure. */
export function tryParseDate(s: string): Date | null {
  if (!s) return null;
  // ISO / YYYY-MM-DD variants
  const iso = Regex.dateIsoStrict.exec(s);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  // MM/DD/YYYY
  const mdy = Regex.dateSlashMdy.exec(s);
  if (mdy) return new Date(+mdy[3], +mdy[1] - 1, +mdy[2]);
  // DD/MM/YYYY — ambiguous, try after MDY
  const dmy = Regex.dateSlashMdy.exec(s);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  // Natural: "January 5, 2026" / "5 January 2026" / "Mon, January 5, 2026"
  const nat = Date.parse(s);
  if (!isNaN(nat)) return new Date(nat);
  return null;
}
