import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Covers the pure logic in src/lib (scheduler, scoring, csv, format, …) and in
// the Supabase edge functions (release-channel selection).
// Component/UI code is exercised via `npm run web`, not vitest.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
  },
});
