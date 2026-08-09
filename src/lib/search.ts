/**
 * Token search shared by list screens.
 *
 * Two rules, both aimed at how people actually type part names:
 *
 *   1. Anything that is not a letter or digit is a SEPARATOR, so "u channel",
 *      "u-channel" and "U/Channel" all find "U-Channel".
 *   2. Spaces split the query into independent tokens rather than requiring one
 *      contiguous run, so "odom pod" finds "goBILDA 4-Bar Odometry Pod".
 *
 * Tokens match as substrings, not whole words, so "odom" still finds
 * "Odometry" and "bilda" still finds "goBILDA". Every token must appear
 * somewhere, but their order does not matter.
 */

// Deliberately ASCII. Normalisation is applied to BOTH sides, so an accented
// name still matches itself ("café" and "cafe" both reduce to the token "caf");
// this avoids depending on unicode property escapes in the RN engine.
const SEPARATORS = /[^a-z0-9]+/g;

function normalize(value: string): string {
  return value.toLowerCase().replace(SEPARATORS, ' ').trim();
}

/** The query split into searchable tokens; empty when it holds nothing usable. */
export function searchTokens(query: string): string[] {
  const normalized = normalize(query);
  return normalized ? normalized.split(' ') : [];
}

/**
 * True when every token in `query` appears somewhere across `fields`.
 * An empty or punctuation-only query matches everything, so a stray "-" does
 * not blank the list.
 */
export function matchesSearch(
  fields: readonly (string | null | undefined)[],
  query: string
): boolean {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return true;
  const haystack = normalize(fields.filter(Boolean).join(' '));
  return tokens.every((token) => haystack.includes(token));
}
