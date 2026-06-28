#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
  cat >&2 <<'EOF'
No Developer ID Application certificate was found in your Keychain.

Install the certificate, then verify it with:
  security find-identity -v -p codesigning | grep "Developer ID Application"
EOF
  exit 1
fi

notary_args=()
if [[ -n "${APPLE_KEYCHAIN_PROFILE:-}" || -z "${APPLE_ID:-}${APPLE_APP_SPECIFIC_PASSWORD:-}${APPLE_TEAM_ID:-}${APPLE_API_KEY:-}${APPLE_API_KEY_ID:-}${APPLE_API_ISSUER:-}" ]]; then
  APPLE_KEYCHAIN_PROFILE="${APPLE_KEYCHAIN_PROFILE:-gentoo-notary}"
  export APPLE_KEYCHAIN_PROFILE
  notary_args+=(--keychain-profile "$APPLE_KEYCHAIN_PROFILE")
  if [[ -n "${APPLE_KEYCHAIN:-}" ]]; then
    export APPLE_KEYCHAIN
    notary_args+=(--keychain "$APPLE_KEYCHAIN")
  fi
elif [[ -n "${APPLE_ID:-}" || -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" || -n "${APPLE_TEAM_ID:-}" ]]; then
  : "${APPLE_ID:?Set APPLE_ID for notarization.}"
  : "${APPLE_APP_SPECIFIC_PASSWORD:?Set APPLE_APP_SPECIFIC_PASSWORD for notarization.}"
  : "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID for notarization.}"
  export APPLE_ID APPLE_APP_SPECIFIC_PASSWORD APPLE_TEAM_ID
  notary_args+=(--apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID")
elif [[ -n "${APPLE_API_KEY:-}" || -n "${APPLE_API_KEY_ID:-}" || -n "${APPLE_API_ISSUER:-}" ]]; then
  : "${APPLE_API_KEY:?Set APPLE_API_KEY for notarization.}"
  : "${APPLE_API_KEY_ID:?Set APPLE_API_KEY_ID for notarization.}"
  : "${APPLE_API_ISSUER:?Set APPLE_API_ISSUER for notarization.}"
  export APPLE_API_KEY APPLE_API_KEY_ID APPLE_API_ISSUER
  notary_args+=(--key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER")
else
  cat >&2 <<'EOF'
No Apple notarization credentials were found.

Recommended one-time setup:
  xcrun notarytool store-credentials gentoo-notary --apple-id "YOUR_APPLE_ID" --team-id "29LT93G54W"

Then run:
  npm run mac:release
EOF
  exit 1
fi

npm run export:web
npx electron-builder --mac dmg --arm64 --config electron-builder.json

shopt -s nullglob
apps=(desktop-build/mac-arm64/Gentoo.app)
dmgs=(desktop-build/*mac-arm64.dmg)

if (( ${#apps[@]} == 0 )); then
  echo "No built Gentoo.app bundles were found in desktop-build/." >&2
  exit 1
fi

if (( ${#dmgs[@]} == 0 )); then
  echo "No DMG artifacts were found in desktop-build/." >&2
  exit 1
fi

for app in "${apps[@]}"; do
  codesign --verify --deep --strict --verbose=2 "$app"
done

for dmg in "${dmgs[@]}"; do
  xcrun notarytool submit "$dmg" --wait --timeout 30m "${notary_args[@]}"
  xcrun stapler staple "$dmg"
  xcrun stapler validate "$dmg"
  spctl -a -vvv -t install "$dmg"
done
