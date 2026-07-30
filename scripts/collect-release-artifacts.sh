#!/usr/bin/env bash
# Gather the installers produced by `npm run release:all` into a clean releases/
# directory, named so the Downloads Edge Function recognizes every file:
#   Gentoo-<version>-android.apk     /(?:android|apk).*\.apk$/i
# (supabase/functions/downloads/releases.ts holds the patterns.)
#
# iOS ships through TestFlight, so it has no artifact here. The desktop app was
# retired, so there are no dmg/exe/deb installers or electron-updater feeds to
# collect any more.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"

fail() {
  echo "error: $1" >&2
  echo "Run the corresponding build stage first (npm run release:all runs them all)." >&2
  exit 1
}

[[ -f android-build/Gentoo.apk ]] || fail "no Android APK found at android-build/Gentoo.apk"

rm -rf releases
mkdir releases

cp android-build/Gentoo.apk "releases/Gentoo-${VERSION}-android.apk"

echo "Release artifacts (v${VERSION}):"
ls -lh releases/ | tail -n +2
