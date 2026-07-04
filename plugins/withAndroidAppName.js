const { AndroidConfig, withStringsXml } = require('expo/config-plugins');

/**
 * Overrides the Android launcher label (strings.xml `app_name`) without
 * touching the Expo `name` field, which also controls the iOS display name.
 * Used by app.config.js to label beta builds "Gentoo Beta" while iOS store
 * builds keep their name.
 */
module.exports = function withAndroidAppName(config, { name }) {
  return withStringsXml(config, (mod) => {
    mod.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: 'app_name' }, _: name }],
      mod.modResults
    );
    return mod;
  });
};
