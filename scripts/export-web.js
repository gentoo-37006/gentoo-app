const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
// In-process transforms avoid Metro's intermittent Windows worker crashes.
const result = spawnSync(process.execPath, [
  require.resolve('expo/bin/cli'), 'export', '--platform', 'web', '--clear', '--max-workers', '0',
], {
  cwd: projectRoot,
  env: { ...process.env, GENTOO_WEB_EXPORT: '1' },
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) {
  console.error(`[export-web] Expo exited with ${result.signal ?? result.status ?? 'an unknown error'}`);
  process.exit(result.status ?? 1);
}

// Expo prefixes resource URLs, but leaves the files at the export root.
// Mount the complete export beneath /app and keep OS association files at /.
const dist = path.join(projectRoot, 'dist');
const entries = fs.readdirSync(dist);
const app = path.join(dist, 'app');
fs.mkdirSync(app);
for (const entry of entries) {
  if (entry === '.well-known' || entry === 'privacy.html') continue;
  fs.renameSync(path.join(dist, entry), path.join(app, entry));
}
fs.cpSync(path.join(projectRoot, 'website'), dist, { recursive: true });
fs.copyFileSync(path.join(projectRoot, 'assets/images/icon.png'), path.join(dist, 'team-icon.png'));

require('./write-version');
console.log('[export-web] Team website: /; Gentoo app: /app');
