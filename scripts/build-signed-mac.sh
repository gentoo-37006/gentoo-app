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

product_name="${MAC_PRODUCT_NAME:-Gentoo}"
builder_args=(--mac dmg --arm64 --config electron-builder.json --publish never)

if [[ -n "${MAC_APP_ID:-}" ]]; then
  builder_args+=("-c.appId=${MAC_APP_ID}")
fi

if [[ -n "${MAC_PRODUCT_NAME:-}" ]]; then
  builder_args+=("-c.productName=${MAC_PRODUCT_NAME}")
  # Inject into the packaged package.json too: Electron derives app.getName()
  # (and therefore the userData dir) from there, so release and beta keep
  # separate data and can run side by side.
  builder_args+=("-c.extraMetadata.productName=${MAC_PRODUCT_NAME}")
  # Artifact names must not contain spaces ("Gentoo Beta-…"): GitHub rewrites
  # spaces in release assets, which breaks the electron-updater feed URLs.
  builder_args+=("-c.artifactName=${MAC_PRODUCT_NAME// /-}-"'${version}-${os}-${arch}.${ext}')
fi

if [[ -n "${MAC_VERSION:-}" ]]; then
  builder_args+=("-c.extraMetadata.version=${MAC_VERSION}")
fi

npm run export:web
# Appearance-aware (light/dark) macOS app icon catalog, shipped as a resource.
bash scripts/build-mac-appearance-icons.sh
# Clear stale artifacts (e.g. a previous version's DMG) so the notarize/staple
# loop below only ever operates on the DMG we just built.
rm -rf desktop-build
npx electron-builder "${builder_args[@]}"

shopt -s nullglob
apps=(desktop-build/mac-arm64/"$product_name".app)
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
done

for app in "${apps[@]}"; do
  xcrun stapler staple "$app"
  xcrun stapler validate "$app"
done

for dmg in "${dmgs[@]}"; do
  xcrun stapler staple "$dmg"
  xcrun stapler validate "$dmg"
done

# Notarizing and stapling the DMG registers the app's signature with Apple, and
# stapling the app bundle keeps the launch path valid even before Gatekeeper can
# make a network check.
# We deliberately do NOT spctl-assess the .dmg: electron-builder ships it
# unsigned (notarized + stapled is what counts), and `spctl -t install`/`-t open`
# on an unsigned DMG always reports "no usable signature" and aborts under set -e.
for app in "${apps[@]}"; do
  spctl -a -t exec -vvv "$app"
done
