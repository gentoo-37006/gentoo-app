#!/usr/bin/env bash
# Gather the installers produced by `npm run release:all` into a clean releases/
# directory, named so the Downloads Edge Function recognizes every file
# (supabase/functions/downloads/index.ts):
#   Gentoo-<version>-mac-arm64.dmg   /mac.*arm64\.dmg$/i
#   Gentoo-<version>-win-x64.exe     /win.*x64.*\.exe$/i
#   Gentoo-<version>-android.apk     /(?:android|apk).*\.apk$/i
# Copies (not moves): desktop-build/ keeps the auto-update latest*.yml/blockmaps.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"

fail() {
  echo "error: $1" >&2
  echo "Run the corresponding build stage first (npm run release:all runs them all)." >&2
  exit 1
}

shopt -s nullglob
dmgs=(desktop-build/Gentoo-*-mac-arm64.dmg)
exes=(desktop-build/Gentoo-*-win-x64.exe)
# Auto-update needs these on the GitHub release too: the mac zip is what
# electron-updater actually installs, and the yml files are the update feed
# (served to apps by the downloads Edge Function). Blockmaps enable
# differential downloads. Feed globs are latest*/beta* on purpose — they skip
# electron-builder's builder-debug.yml.
zips=(desktop-build/Gentoo-*-mac-arm64.zip)
mac_feeds=(desktop-build/latest-mac.yml desktop-build/beta-mac.yml)
win_feeds=(desktop-build/latest.yml desktop-build/beta.yml)
blockmaps=(desktop-build/*.blockmap)
shopt -u nullglob

(( ${#dmgs[@]} > 0 )) || fail "no macOS DMG found in desktop-build/ (expected Gentoo-*-mac-arm64.dmg)"
(( ${#zips[@]} > 0 )) || fail "no macOS update zip found in desktop-build/ (expected Gentoo-*-mac-arm64.zip)"
(( ${#exes[@]} > 0 )) || fail "no Windows installer found in desktop-build/ (expected Gentoo-*-win-x64.exe)"
(( ${#mac_feeds[@]} > 0 )) || fail "no macOS update feed found in desktop-build/ (expected latest-mac.yml or beta-mac.yml)"
(( ${#win_feeds[@]} > 0 )) || fail "no Windows update feed found in desktop-build/ (expected latest.yml or beta.yml)"
[[ -f android-build/Gentoo.apk ]] || fail "no Android APK found at android-build/Gentoo.apk"

rm -rf releases
mkdir releases

cp "${dmgs[@]}" "${zips[@]}" "${exes[@]}" "${mac_feeds[@]}" "${win_feeds[@]}" releases/
(( ${#blockmaps[@]} > 0 )) && cp "${blockmaps[@]}" releases/
cp android-build/Gentoo.apk "releases/Gentoo-${VERSION}-android.apk"

echo "Release artifacts (v${VERSION}):"
ls -lh releases/ | tail -n +2
