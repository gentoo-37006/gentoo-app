// Fails the build when the public Supabase vars are missing.
//
// EXPO_PUBLIC_* values are inlined into the bundle by `expo export`, so a build
// without them produces an app that launches but can never reach the backend —
// it just shows "Backend not configured" to whoever installs it. Catching that
// here is the difference between a failed build and a broken release.
//
// Values come from the environment (Render, EAS, CI) or from a local .env file,
// which is what Expo itself reads for desktop builds.

const fs = require('node:fs');
const path = require('node:path');

const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
// Same precedence Expo uses: .env.local wins over .env, and a real environment
// variable wins over both.
const ENV_FILES = ['.env.local', '.env'];

function readEnvFile(file) {
  const values = {};
  let contents;
  try {
    contents = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  } catch {
    return values; // absent or unreadable — the env may still supply the value
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    values[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

const fromFiles = {};
for (const file of ENV_FILES) {
  const values = readEnvFile(file);
  for (const [key, value] of Object.entries(values)) {
    if (!(key in fromFiles)) fromFiles[key] = value; // earlier file wins
  }
}

const missing = required.filter((key) => !(process.env[key] || fromFiles[key]));

if (missing.length > 0) {
  console.error(
    [
      '[check-public-env] Missing required public environment variables:',
      ...missing.map((key) => `  - ${key}`),
      '',
      'Without these the exported app cannot reach Supabase and shows',
      '"Backend not configured" on launch.',
      '',
      'Local builds: cp .env.example .env and fill in the values from',
      '  Supabase -> Project Settings -> API (Project URL + anon public key).',
      'Render / EAS / CI: set them on the build host before the export.',
    ].join('\n')
  );
  process.exit(1);
}

console.log('[check-public-env] required public env vars are set.');
