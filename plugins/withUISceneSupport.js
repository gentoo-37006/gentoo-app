// Expo config plugin: adopt the UIScene lifecycle.
//
// The iOS 26+/27 SDK (Xcode 26/27) requires UIScene lifecycle adoption (Apple
// TN3187). Expo SDK 56 / RN 0.85 still generate a legacy AppDelegate that creates
// the window in didFinishLaunching with no scene manifest, so apps built against
// the new SDK fail to launch ("UIScene life cycle is required for apps built with
// this SDK") — a white screen then immediate termination.
//
// This plugin (a) adds a UIApplicationSceneManifest pointing at a SceneDelegate and
// (b) appends a minimal SceneDelegate to AppDelegate.swift that attaches the window
// the AppDelegate already created to the connecting window scene. Applied at
// prebuild time so it survives `expo prebuild --clean`.
const { withInfoPlist, withAppDelegate } = require('@expo/config-plugins');

const SCENE_DELEGATE_MARKER = 'class SceneDelegate';

const SCENE_DELEGATE_SWIFT = `

// Added by withUISceneSupport: minimal UIScene adoption required by the iOS 26+/27 SDK.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    if let appDelegate = UIApplication.shared.delegate as? AppDelegate,
       let existingWindow = appDelegate.window {
      existingWindow.windowScene = windowScene
      self.window = existingWindow
      existingWindow.makeKeyAndVisible()
    }
  }

  // Forward deep links / the expo-dev-client URL delivered via the scene.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }
}
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

function withSceneDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (!cfg.modResults.contents.includes(SCENE_DELEGATE_MARKER)) {
      cfg.modResults.contents += SCENE_DELEGATE_SWIFT;
    }
    return cfg;
  });
}

module.exports = function withUISceneSupport(config) {
  return withSceneDelegate(withSceneManifest(config));
};
