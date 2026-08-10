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

  private func forwardURL(_ url: URL) {
    if let appDelegate = UIApplication.shared.delegate as? AppDelegate {
      _ = appDelegate.application(UIApplication.shared, open: url, options: [:])
    }
    RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }

  private func forwardUserActivity(_ userActivity: NSUserActivity) {
    guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
          userActivity.webpageURL != nil else { return }

    if let appDelegate = UIApplication.shared.delegate as? AppDelegate {
      _ = appDelegate.application(
        UIApplication.shared,
        continue: userActivity,
        restorationHandler: { _ in }
      )
    }
    RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }

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

    // UIScene removes incoming links from AppDelegate launchOptions. Forward
    // them here so expo-linking can cache the URL before Expo Router starts.
    if let userActivity = connectionOptions.userActivities.first(where: {
      $0.activityType == NSUserActivityTypeBrowsingWeb
    }) {
      forwardUserActivity(userActivity)
    }
    if let url = connectionOptions.urlContexts.first?.url {
      forwardURL(url)
    }
  }

  // Forward deep links / the expo-dev-client URL delivered via the scene.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    forwardURL(url)
  }

  // Universal Links arrive as NSUserActivity, not as openURLContexts.
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    forwardUserActivity(userActivity)
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
