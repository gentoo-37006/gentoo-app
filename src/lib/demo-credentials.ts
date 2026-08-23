/**
 * The review/demo account. These credentials are handed to App Store reviewers
 * in the submission notes and are checked entirely on-device — `signInDemo()`
 * opens the seeded offline workspace, so this path works with no backend at all.
 *
 * Because a reviewer *pastes* them out of the notes, matching has to survive the
 * transport. Build 47 was rejected under guideline 2.1(a) ("our login attempt
 * launched to an error message") with an exact `password !== DEMO_PASSWORD`
 * comparison in place: correct credentials carrying a trailing space failed, and
 * the failure copy then told the reviewer they had no account. Normalize before
 * comparing, and say which half did not match.
 */

export const DEMO_EMAIL = 'alex.rivera@gentoorobotics.org';
export const DEMO_PASSWORD = 'Gentoo2026!';

/**
 * Zero-width space / non-joiner / joiner / word-joiner / BOM. `.trim()` already
 * handles NBSP and ordinary whitespace at the ends, but these ride along inside
 * a pasted string and are invisible to anyone trying to work out why a password
 * that "looks right" keeps failing. Written as code points so the source file
 * itself stays free of characters no one can see.
 */
const INVISIBLE_CODE_POINTS = new Set([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff]);

/** A credential as typed or pasted, minus everything that isn't really there. */
export function normalizeCredential(value: string): string {
  let stripped = '';
  for (const char of value) {
    if (!INVISIBLE_CODE_POINTS.has(char.codePointAt(0) ?? 0)) stripped += char;
  }
  return stripped.trim();
}

export type CredentialCheck = 'ok' | 'empty' | 'unknown-email' | 'wrong-password';

/**
 * Pure so it can be tested without a keyboard: every interesting case is about
 * what a touch keyboard or a clipboard adds around the edges of a string.
 */
export function checkDemoCredentials(email: string, password: string): CredentialCheck {
  const normalizedEmail = normalizeCredential(email).toLowerCase();
  const normalizedPassword = normalizeCredential(password);

  if (!normalizedEmail || !normalizedPassword) return 'empty';
  if (normalizedEmail !== DEMO_EMAIL) return 'unknown-email';
  // Case-sensitive on purpose — only the surrounding noise is forgiven.
  if (normalizedPassword !== DEMO_PASSWORD) return 'wrong-password';
  return 'ok';
}
