const fs = require('fs');
const packageJson = require('./package.json');

// Firebase config for Android push (FCM). Wired only when present so Android
// builds still succeed before Firebase is set up (they just won't have push);
// drop the file from your Firebase project at the repo root to enable it.
const GOOGLE_SERVICES_FILE = './google-services.json';

function getStoreVersion(version) {
  const match = version.match(/^\d+(?:\.\d+){0,2}/);
  if (!match) {
    throw new Error(`Invalid package version for App Store build: ${version}`);
  }
  return match[0];
}

const appVersion = packageJson.version;

// Beta builds are a separate Android app — "Gentoo Beta", com.gentoo.app.beta —
// so testers can keep stable and beta installed side by side (mirrors the
// desktop split in electron-builder.js; same version rule as electron/main.cjs).
// iOS is intentionally untouched: those builds are store submissions under
// com.gentoo.app regardless of the tree's prerelease tag.
const isBeta = appVersion.includes('-beta');

// Universal / App Link hosts. iOS keeps one bundle id across both channels, so
// app.json claims both domains there; Android splits into two packages, so the
// host is swapped per build below.
const PRODUCTION_HOST = 'gentoo.ethanyanxu.com';
const BETA_HOST = 'beta.gentoo.ethanyanxu.com';

module.exports = ({ config }) => {
  const android = { ...config.android };
  const plugins = [...(config.plugins ?? [])];

  if (isBeta) {
    android.package = 'com.gentoo.app.beta';
    // The launcher label comes from the Expo `name`, which also names the iOS
    // app — so override Android's strings.xml directly instead.
    plugins.push(['./plugins/withAndroidAppName', { name: 'Gentoo Beta' }]);
    // App Links follow the package: beta is a SEPARATE Android app, so it must
    // claim the beta domain. Leaving it on the production host would put two
    // installed apps in a chooser for the same scanned QR code.
    android.intentFilters = (android.intentFilters ?? []).map((filter) => ({
      ...filter,
      data: (filter.data ?? []).map((entry) => ({
        ...entry,
        host: entry.host === PRODUCTION_HOST ? BETA_HOST : entry.host,
      })),
    }));
  }

  if (fs.existsSync(GOOGLE_SERVICES_FILE)) {
    android.googleServicesFile = GOOGLE_SERVICES_FILE;
  }

  return {
    ...config,
    version: getStoreVersion(appVersion),
    android,
    plugins,
    extra: {
      ...config.extra,
      appVersion,
    },
  };
};
