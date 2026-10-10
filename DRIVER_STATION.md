# Driver Station

Native Driver Station keeps the screen awake while foregrounded. Backgrounding
still neutralizes gamepads and stops the active OpMode. A cold launch returns
to the home screen after the normal account gate; Driver Station is never
restored automatically. Its back button stops the OpMode and navigates home
even when there is no back history.
Native update reloads are deferred while this page is open.
Autonomous and TeleOp each open a separate filtered OpMode dropdown.

`patches/expo-screen-orientation+56.0.5.patch` keeps orientation callbacks off
the registry queue: UIKit can synchronously read that queue on the main thread,
so notifying UIKit from inside it deadlocks launch or screen transitions.
`npm install` reapplies the patch. This fix requires a native rebuild, not an OTA.

## Robot Wi-Fi

Use **Robot Wi-Fi** in the overflow menu (also accessible through connection
details). This opens an in-page settings panel, not another native modal.
Save the Control Hub's exact SSID and WPA2 password, then connect with
one button. Passwords use Expo SecureStore, not AsyncStorage. Network changes are
disabled while an OpMode is active. Gentoo never joins a network on startup.

On Android 10+, the system requests approval and grants a local-only Wi-Fi
connection. Only Driver Station UDP sockets are bound to that connection;
internet requests are not redirected onto the robot network. Android 13+ asks
for Nearby Wi-Fi Devices permission; Android 10-12 uses Location permission and
may require Location services enabled. Older Android versions open Wi-Fi Settings.

On iOS, direct joining requires the **Hotspot Configuration** capability in the
app's signing profile. The Expo config plugin enables it for normal prebuilds.
For a signing team that cannot use this capability, prebuild with:

```sh
GENTOO_IOS_HOTSPOT_CONFIGURATION=0 npx expo prebuild --platform ios
```

Such builds retain saved credentials but require joining through iOS Settings.
iOS does not expose a public API to open the Wi-Fi Settings pane directly, so
the Settings button opens Gentoo's app settings. Direct-capability builds use
the OS join approval prompt; joining Wi-Fi is not proof the robot is connected.
The link status stays offline until Control Hub packets are received.

Adding SecureStore requires rebuilding native binaries (and `pod install` on
an existing iOS checkout). Personal bundle/package identifiers remain local.

Account startup stops waiting for network refresh after five seconds on native
and restores the SDK's existing saved session. The cached profile must still
pass the normal approval gate. Online auth results reconcile that session;
explicit sign-out and non-network auth failures do not use the offline fallback.
Account and profile requests have an eight-second network deadline.
