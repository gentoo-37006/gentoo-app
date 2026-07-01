// Writes dist/version.json after `expo export`, so the running web app can poll
// it and detect when a newer build has been deployed.
//
// The identifier matches what the client bakes in (see src/lib/env.ts):
//   - beta builds set EXPO_PUBLIC_COMMIT_SHA -> id is the commit SHA
//   - release builds leave it unset          -> id is the app version
// so the client compares like-for-like and never false-positives across channels.
const fs = require('fs');
const path = require('path');

const appJson = require('../app.json');

const commit = process.env.EXPO_PUBLIC_COMMIT_SHA || '';
const version = (appJson.expo && appJson.expo.version) || '0.0.0';
const channel = commit ? 'beta' : 'release';
const id = commit || version;

const manifest = { channel, id, commit, version, builtAt: new Date().toISOString() };

const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  console.error(`[write-version] dist directory not found at ${distDir} — run after "expo export".`);
  process.exit(1);
}

const outFile = path.join(distDir, 'version.json');
fs.writeFileSync(outFile, JSON.stringify(manifest));
console.log('[write-version] wrote', outFile, manifest);
