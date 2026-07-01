const appJson = require('./app.json');
const packageJson = require('./package.json');

function getStoreVersion(version) {
  const match = version.match(/^\d+(?:\.\d+){0,2}/);
  if (!match) {
    throw new Error(`Invalid package version for App Store build: ${version}`);
  }
  return match[0];
}

const appVersion = packageJson.version;

module.exports = () => ({
  ...appJson.expo,
  version: getStoreVersion(appVersion),
  extra: {
    ...appJson.expo.extra,
    appVersion,
  },
});
