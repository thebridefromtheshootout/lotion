// ── Tiny date formatter (no deps) ─────────────────────────────────

const MONTHS = [
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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

export function formatDate(d: Date, fmt: string): string {
  const YYYY = String(d.getFullYear());
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const D = String(d.getDate());
  const MMMM = MONTHS[d.getMonth()];
  const ddd = DAYS[d.getDay()];
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());

  return fmt
    .replace("YYYY", YYYY)
    .replace("MMMM", MMMM)
    .replace("MM", MM)
    .replace("DD", DD)
    .replace(/\bD\b/, D)
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
