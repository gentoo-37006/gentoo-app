#!/usr/bin/env bash
# Build the iOS app LOCALLY (no EAS cloud build) and stop at the .ipa — the
# upload to App Store Connect / TestFlight is done by hand with Transporter,
# which skips EAS's submitter queue. Signing credentials are still pulled from
# EAS, same as the cloud build. Requires Xcode, fastlane and CocoaPods here.
#
# SUBMIT=1 restores the old auto-submit-through-EAS behaviour.
set -euo pipefail

# fastlane (and CocoaPods) require a UTF-8 locale; don't depend on the shell's.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

OUT="${OUT:-ios-build/Gentoo.ipa}"

# Xcode only runs on macOS, so a local iOS build is impossible anywhere else —
# check this before the toolchain hints below, which would otherwise send a
# Linux user chasing fastlane for a build that still cannot happen.
if [[ "$(uname -s)" != "Darwin" ]]; then
  cat >&2 <<EOF
iOS apps can only be built on macOS (Xcode is required), and this is $(uname -s).

Build iOS on EAS's macOS workers instead:
  npm run ios:publish:cloud

The rest of the release runs fine here:
  npm run android:apk && npm run release:collect

'npm run release:all' chains the local iOS build first, so it cannot complete
on this machine.
EOF
  exit 1
fi

if ! command -v fastlane >/dev/null 2>&1; then
  cat >&2 <<'EOF'
'fastlane' not found on PATH — 'eas build --local' requires it for iOS.

Install it, then rerun:
  brew install fastlane
EOF
  exit 1
fi

# Checked here for the same reason as fastlane: the pod install happens deep
# inside the local build plugin, so without this the run first authenticates,
# resolves remote credentials and BURNS A BUILD NUMBER, then dies on
# "spawn pod ENOENT" minutes later.
if ! command -v pod >/dev/null 2>&1; then
  cat >&2 <<'EOF'
'pod' (CocoaPods) not found on PATH — 'eas build --local' needs it to install
the native pods for iOS.

Install it, then rerun:
  brew install cocoapods
EOF
  exit 1
fi

# Build with a STABLE Xcode. Expo SDK 56 / RN 0.85 don't compile under beta
# Xcode toolchains (Swift errors deep in the pods), so prefer /Applications/
# Xcode.app and fail fast if only a beta is available. DEVELOPER_DIR is honored
# by xcodebuild/fastlane, so this never touches the global xcode-select.
if [[ -n "${DEVELOPER_DIR:-}" ]]; then
  if [[ ! -x "${DEVELOPER_DIR}/usr/bin/xcodebuild" ]]; then
    echo "DEVELOPER_DIR is set but invalid: ${DEVELOPER_DIR}" >&2
    exit 1
  fi
elif [[ -x "/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild" ]]; then
  export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
else
  selected="$(xcode-select -p 2>/dev/null || true)"
  if [[ "$selected" == *"-beta.app"* || "$selected" == *"Xcode-beta"* ]]; then
    cat >&2 <<'EOF'
Only a BETA Xcode is selected, and Expo SDK 56 / React Native 0.85 do not build
under beta Xcode toolchains (the archive fails with Swift errors in the pods).

Install the current stable Xcode to /Applications/Xcode.app (App Store or
https://developer.apple.com/download/), then rerun. To use a stable Xcode at a
different path, set DEVELOPER_DIR, e.g.:
  DEVELOPER_DIR="/Applications/Xcode-26.app/Contents/Developer" npm run ios:publish
EOF
    exit 1
  fi
  # A non-beta selected Xcode: let the default selection stand.
fi

echo "Using Xcode: ${DEVELOPER_DIR:-$(xcode-select -p)}"
xcodebuild -version | head -2

mkdir -p "$(dirname "$OUT")"

# `eas` is a global install on the release machines; fall back to npx elsewhere.
# Same resolution as publish-ios.sh / publish-android.sh — without it a Mac that
# has Xcode and fastlane but no global CLI dies here with "eas: command not
# found", after the toolchain checks above have already passed.
if command -v eas >/dev/null 2>&1; then
  eas_cmd=(eas)
else
  echo "[ios] 'eas' is not on PATH — running it through npx."
  eas_cmd=(npx --yes eas-cli)
fi

# Build on this machine. The upload is deliberately NOT run here: `eas submit`
# queues on EAS's shared submitter pool ("waiting for an available submitter"),
# which routinely takes longer than the build did, and it stalls the rest of
# `release:all` behind it. Uploading the same .ipa with Transporter is faster
# and hands the wait to a human who can walk away from it.
#
# Set SUBMIT=1 to restore the old behaviour (useful when nobody is at the Mac).
"${eas_cmd[@]}" build --platform ios --profile production --local --output "$OUT" --non-interactive

if [[ "${SUBMIT:-0}" == "1" ]]; then
  echo "[ios] SUBMIT=1 — submitting through EAS instead of Transporter."
  "${eas_cmd[@]}" submit --platform ios --profile production --path "$OUT" --non-interactive
  exit 0
fi

IPA_PATH="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"

cat <<EOF

────────────────────────────────────────────────────────────────────────
[ios] Build complete — upload is a manual step.

  ${IPA_PATH}

Open Transporter, sign in with the Apple ID for team 29LT93G54W, drag the
.ipa in, and Deliver. It lands in TestFlight the same as an EAS submit.

  Transporter: https://apps.apple.com/app/transporter/id1450874784

The build number was already incremented by EAS, so this .ipa is unique and
can be uploaded as-is. To submit through EAS instead: SUBMIT=1 npm run ios:publish
────────────────────────────────────────────────────────────────────────
EOF

# Reveal it in Finder so the next step is a drag, not a path hunt. Interactive
# runs only — a CI/non-tty run must not try to open a GUI.
if [[ -t 1 ]] && command -v open >/dev/null 2>&1; then
  open -R "$IPA_PATH" 2>/dev/null || true
fi
