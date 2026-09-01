// Start in portrait before JavaScript loads. Driver Station mode can still use
// expo-screen-orientation to set a fixed landscape direction at runtime.
const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidDefaultOrientation(config) {
  return withAndroidManifest(config, (cfg) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    mainActivity.$['android:screenOrientation'] = 'portrait';
    return cfg;
  });
};
