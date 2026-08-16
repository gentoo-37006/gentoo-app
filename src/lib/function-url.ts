/**
 * URL of a Supabase Edge Function, or '' when the app has no Supabase URL.
 *
 * The empty string matters. `${SUPABASE_URL}/functions/v1/downloads` with an
 * unset URL leaves a bare `/functions/v1/downloads` — a *relative* path. On web
 * that resolves against the app's own origin, and both the Metro dev server and
 * the exported SPA answer any unknown path with index.html and a 200. So the
 * fetch "succeeds", `res.ok` is true, and the only symptom is a JSON parse error
 * deep inside a query — which renders as "couldn't load" rather than the real
 * cause. Returning '' lets callers skip the request and say what's actually wrong.
 */
export function functionUrl(supabaseUrl: string, name: string): string {
  const base = supabaseUrl.replace(/\/+$/, '');
  return base ? `${base}/functions/v1/${name}` : '';
}
