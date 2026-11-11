// Reads a public build value the way Expo does: a real environment variable
// wins, then .env.local, then .env.
//
// The export scripts run in plain Node, before and after `expo export`, so
// nothing has loaded the .env files for them.

const fs = require('node:fs');
const path = require('node:path');

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

let fromFiles = null;

function publicEnv(key) {
  if (process.env[key]) return process.env[key];
  if (!fromFiles) {
    fromFiles = {};
    for (const file of ENV_FILES) {
      const values = readEnvFile(file);
      for (const [name, value] of Object.entries(values)) {
        if (!(name in fromFiles)) fromFiles[name] = value; // earlier file wins
      }
    }
  }
  return fromFiles[key] || '';
}

module.exports = { publicEnv };
