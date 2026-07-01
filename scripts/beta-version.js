// Prints the beta desktop version: <base>-beta.<YYYYMMDD in America/Toronto>.
// The `-beta.` prerelease makes electron-builder publish to the 'beta' update
// channel, and the date keeps versions increasing so installed beta desktop
// apps self-update to each morning's build.
const base = require('../package.json').version.split('-')[0];
const date = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date()).replace(/-/g, '');
process.stdout.write(`${base}-beta.${date}`);
