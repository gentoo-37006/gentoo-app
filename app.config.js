const packageJson = require('./package.json');

function getStoreVersion(version) {
  const match = version.match(/^\d+(?:\.\d+){0,2}/);
  if (!match) {
    throw new Error(`Invalid package version for App Store build: ${version}`);
  }
  return match[0];
}

const appVersion = packageJson.version;

module.exports = ({ config }) => ({
  ...config,
  version: getStoreVersion(appVersion),
  extra: {
    ...config.extra,
    appVersion,
  },
});
