#!/usr/bin/env bash
# Build the iOS app LOCALLY (no EAS cloud build) and submit it to App Store
# Connect / TestFlight. Signing credentials + the ASC API key are pulled from
# EAS, same as the cloud build. Requires Xcode and fastlane on this machine.
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

# Build on this machine, then submit the resulting .ipa.
eas build --platform ios --profile production --local --output "$OUT" --non-interactive
eas submit --platform ios --profile production --path "$OUT" --non-interactive
