const { withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

module.exports = function withDriverStationWifi(config, { iosHotspotConfiguration = true } = {}) {
  config = withEntitlementsPlist(config, (cfg) => {
    if (iosHotspotConfiguration) cfg.modResults['com.apple.developer.networking.HotspotConfiguration'] = true;
    else delete cfg.modResults['com.apple.developer.networking.HotspotConfiguration'];
    return cfg;
  });
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.GentooHotspotConfigurationEnabled = iosHotspotConfiguration;
    return cfg;
  });
};
