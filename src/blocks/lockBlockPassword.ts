// ── Last-password memo (TTL-bounded) ───────────────────────────────
//
// Convenience for users who lock/unlock several boxes back-to-back. The
// password is held in memory only — never persisted — and is wiped after
// PASSWORD_TTL_MS so a long-lived extension host can't accumulate
// secrets indefinitely. Prefer touchLastPassword() / readLastPassword()
// over poking lastPassword directly.

const PASSWORD_TTL_MS = 5 * 60 * 1000; // 5 minutes
let lastPassword: string | undefined;
let lastPasswordExpiry = 0;
let lastPasswordTimer: ReturnType<typeof setTimeout> | undefined;

export function touchLastPassword(password: string): void {
  lastPassword = password;
  lastPasswordExpiry = Date.now() + PASSWORD_TTL_MS;
  if (lastPasswordTimer) clearTimeout(lastPasswordTimer);
  lastPasswordTimer = setTimeout(clearLastPassword, PASSWORD_TTL_MS);
}

export function readLastPassword(): string | undefined {
  if (lastPassword && Date.now() < lastPasswordExpiry) return lastPassword;
  if (lastPassword) clearLastPassword();
  return undefined;
}

export function clearLastPassword(): void {
  lastPassword = undefined;
  lastPasswordExpiry = 0;
  if (lastPasswordTimer) {
    clearTimeout(lastPasswordTimer);
    lastPasswordTimer = undefined;
  }
}
