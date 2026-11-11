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

// The scouting-card page (/allianceinfo/<team>) is plain HTML with no bundler,
// so it cannot have the public Supabase settings inlined the way the app does.
// Hand them over in a script it loads, with the field images the app ships.
const { publicEnv } = require('./public-env');
const cardDir = path.join(dist, 'allianceinfo');
const cardConfig = {
  supabaseUrl: publicEnv('EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: publicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
};
fs.writeFileSync(path.join(cardDir, 'config.js'), `window.GENTOO_PUBLIC = ${JSON.stringify(cardConfig)};\n`);
fs.cpSync(path.join(projectRoot, 'assets/images/fields'), path.join(cardDir, 'fields'), { recursive: true });

require('./write-version');
console.log('[export-web] Team website: /; Gentoo app: /app; scouting cards: /allianceinfo/<team>');
