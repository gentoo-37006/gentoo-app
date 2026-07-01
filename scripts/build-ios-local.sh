#!/usr/bin/env bash
# Build the iOS app LOCALLY (no EAS cloud build) and submit it to App Store
# Connect / TestFlight. Signing credentials + the ASC API key are pulled from
# EAS, same as the cloud build. Requires Xcode and fastlane on this machine.
set -euo pipefail

OUT="${OUT:-ios-build/Gentoo.ipa}"

if ! command -v fastlane >/dev/null 2>&1; then
  echo "warning: 'fastlane' not found on PATH — 'eas build --local' needs it for iOS (brew install fastlane)." >&2
fi

mkdir -p "$(dirname "$OUT")"

# Build on this machine, then submit the resulting .ipa.
eas build --platform ios --profile production --local --output "$OUT" --non-interactive
eas submit --platform ios --profile production --path "$OUT" --non-interactive
