// Dynamic electron-builder config (CommonJS — the repo has no "type":"module").
//
// App identity is derived from the package.json version's beta-ness, using the
// SAME rule electron/main.cjs applies at runtime (IS_BETA = version includes
// "-beta"). Keeping build-time and runtime identity in one place means a beta
// build is always a fully separate app — "Gentoo Beta", com.gentoo.app.beta,
// its own userData dir — so it installs and runs alongside the stable app
// without interfering. Bump the version to X.Y.Z-beta.N for a beta, X.Y.Z for
// a release; no per-script overrides needed.
const { version } = require('./package.json');
const isBeta = version.includes('-beta');

const productName = isBeta ? 'Gentoo Beta' : 'Gentoo';
const appId = isBeta ? 'com.gentoo.app.beta' : 'com.gentoo.app.desktop';
// Space-free artifact base: GitHub rewrites spaces in release asset names,
// which would break the electron-updater feed URLs. So "Gentoo-Beta-…", not
// "${productName}-…" (which would yield "Gentoo Beta-…").
const artifactBase = isBeta ? 'Gentoo-Beta' : 'Gentoo';

module.exports = {
  appId,
  productName,
  artifactName: artifactBase + '-${version}-${os}-${arch}.${ext}',
  icon: 'assets/images/icon.png',
  directories: {
    output: 'desktop-build',
    buildResources: 'build-resources',
  },
  publish: [
    {
      provider: 'github',
      owner: 'gentoo-34755',
      repo: 'gentoo-app',
    },
  ],
  protocols: [
    {
      name: 'Gentoo',
      schemes: ['gentoo'],
    },
  ],
  toolsets: {
    nsis: '1.2.1',
  },
  files: [
    { from: 'dist', to: 'dist' },
    { from: 'electron', to: 'electron' },
    'package.json',
    '!node_modules/**/android/**',
    '!node_modules/**/ios/**',
    '!node_modules/**/apple/**',
    '!node_modules/**/prebuilds/**',
    '!node_modules/**/*.framework/**',
    '!node_modules/**/*.xcframework/**',
  ],
  // Electron derives app.getName() (and thus the userData dir) from the
  // packaged package.json, so inject productName there too — this is what keeps
  // beta and stable data separate.
  extraMetadata: {
    main: 'electron/main.cjs',
    productName,
  },
  mac: {
    category: 'public.app-category.productivity',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    notarize: false,
    target: ['dmg', 'zip'],
    extendInfo: {
      CFBundleIconName: 'AppIcon',
    },
    extraResources: [
      {
        from: 'build/mac-icons/Assets.car',
        to: 'Assets.car',
      },
    ],
  },
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
  },
  linux: {
    target: [
      {
        target: 'deb',
        arch: ['x64'],
      },
    ],
    category: 'Utility',
    // Required for .deb metadata; package.json intentionally has no author.
    maintainer: 'Gentoo Robotics <ethanxucoder@gmail.com>',
    synopsis: 'Team workspace for Gentoo Robotics (FTC)',
    description:
      'Scouting, tasks, pit radio, and schedules for the Gentoo Robotics FTC team.',
    // Distinct binary + package names let beta and stable install side by side
    // (userData is already split via extraMetadata.productName).
    executableName: isBeta ? 'gentoo-beta' : 'gentoo',
  },
  deb: {
    packageName: isBeta ? 'gentoo-beta' : 'gentoo',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: false,
  },
};
