#!/usr/bin/env bash
# Build the iOS app LOCALLY (no EAS cloud build) and submit it to App Store
# Connect / TestFlight. Signing credentials + the ASC API key are pulled from
# EAS, same as the cloud build. Requires Xcode and fastlane on this machine.
set -euo pipefail

# fastlane (and CocoaPods) require a UTF-8 locale; don't depend on the shell's.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

OUT="${OUT:-ios-build/Gentoo.ipa}"

if ! command -v fastlane >/dev/null 2>&1; then
  cat >&2 <<'EOF'
'fastlane' not found on PATH — 'eas build --local' requires it for iOS.

Install it, then rerun:
  brew install fastlane
EOF
  exit 1
fi

mkdir -p "$(dirname "$OUT")"

# Build on this machine, then submit the resulting .ipa.
eas build --platform ios --profile production --local --output "$OUT" --non-interactive
eas submit --platform ios --profile production --path "$OUT" --non-interactive
