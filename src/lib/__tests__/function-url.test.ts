import { describe, expect, it } from 'vitest';
import { functionUrl } from '@/lib/function-url';

describe('functionUrl', () => {
  it('builds the Edge Function URL from the project URL', () => {
    expect(functionUrl('https://abc.supabase.co', 'downloads')).toBe(
      'https://abc.supabase.co/functions/v1/downloads'
    );
  });

  it('returns empty for an unconfigured project URL', () => {
    // Never '/functions/v1/downloads'. A relative URL resolves against the web
    // app's own origin, where the SPA fallback answers 200 with index.html — so
    // the fetch looks successful and only fails later, inside res.json().
    expect(functionUrl('', 'downloads')).toBe('');
  });

  it('does not double the slash when the project URL has a trailing one', () => {
    expect(functionUrl('https://abc.supabase.co/', 'downloads')).toBe(
      'https://abc.supabase.co/functions/v1/downloads'
    );
    expect(functionUrl('https://abc.supabase.co///', 'downloads')).toBe(
      'https://abc.supabase.co/functions/v1/downloads'
    );
  });

  it('treats a URL of only slashes as unconfigured', () => {
    expect(functionUrl('/', 'downloads')).toBe('');
  });
});
