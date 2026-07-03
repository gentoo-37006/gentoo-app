#!/usr/bin/env bash
# Compiles the appearance-aware macOS app icon (light/dark, macOS 26+) from the
# Icon Composer document assets/mac/AppIcon.icon into build/mac-icons/Assets.car.
# electron-builder ships the catalog via mac.extraResources and sets
# CFBundleIconName=AppIcon (mac.extendInfo); older macOS falls back to the
# regular .icns electron-builder generates. Requires Xcode (actool).
#
# The .icon document is the source of truth — open it in Icon Composer
# (Xcode > Open Developer Tool) to refine the artwork/fills; regenerate the
# glyph layer from the base icon with: swift scripts/generate-mac-icon-layer.swift
set -euo pipefail

cd "$(dirname "$0")/.."

DOC=assets/mac/AppIcon.icon
OUT=build/mac-icons

[[ -f "$DOC/icon.json" ]] || { echo "error: missing $DOC/icon.json" >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT"

xcrun actool "$DOC" --compile "$OUT" \
  --platform macosx --minimum-deployment-target 26.0 \
  --app-icon AppIcon \
  --output-partial-info-plist "$OUT/AppIcon.partial.plist" > "$OUT/actool.log" 2>&1 || {
  cat "$OUT/actool.log" >&2
  echo "error: actool failed" >&2
  exit 1
}

[[ -f "$OUT/Assets.car" ]] || { echo "error: actool did not produce Assets.car" >&2; exit 1; }

# Sanity: the catalog must carry appearance-aware icon groups (incl. dark).
if ! xcrun assetutil --info "$OUT/Assets.car" 2>/dev/null | grep -q '"NSAppearanceNameDarkAqua"'; then
  echo "error: compiled catalog has no dark appearance variants" >&2
  exit 1
fi

echo "Built $OUT/Assets.car (appearance-aware AppIcon, light + dark)"
