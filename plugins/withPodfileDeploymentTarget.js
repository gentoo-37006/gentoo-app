// Expo config plugin: force every CocoaPods target (including resource bundles)
// to a modern iOS deployment target. CocoaPods generates resource-bundle targets
// at each pod's own podspec deployment target (e.g. 12.4 / 13.4), which newer
// Xcode rejects (supported range starts at 15.0). The default Podfile post_install
// (react_native_post_install) does not raise these, so we append a loop that does.
//
// Applied at prebuild time via withDangerousMod so it survives `expo prebuild --clean`.
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const DEPLOYMENT_TARGET = '16.4';
const MARKER = '# expo: force pod deployment target';

const SNIPPET = [
  '',
  `    ${MARKER}`,
  '    installer.pods_project.targets.each do |t|',
  '      t.build_configurations.each do |bc|',
  `        bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${DEPLOYMENT_TARGET}'`,
  '      end',
  '    end',
].join('\n');

module.exports = function withPodfileDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');

      if (!contents.includes(MARKER)) {
        // Preferred: insert right after the react_native_post_install(...) call
        // so our values win. Fall back to the post_install opener if not found.
        const afterRNPostInstall = /(react_native_post_install\([\s\S]*?\n\s*\)\n)/;
        if (afterRNPostInstall.test(contents)) {
          contents = contents.replace(afterRNPostInstall, `$1${SNIPPET}\n`);
        } else {
          contents = contents.replace(
            /(post_install do \|installer\|\n)/,
            `$1${SNIPPET}\n`
          );
        }
        fs.writeFileSync(podfile, contents);
      }

      return cfg;
    },
  ]);
};
