#!/usr/bin/env bash
# Build and submit the iOS app with whichever toolchain this machine can run.
#
# Xcode is macOS-only, so a local build is possible on a Mac and nowhere else.
# On Linux (or anywhere else) this falls through to EAS's macOS workers, which
# produce and submit the same TestFlight build — no local Xcode required.
# `npm run release:all` goes through here so the release works from any machine.
#
# Force one or the other with the explicit scripts:
#   npm run ios:publish        # always local (fails off macOS)
#   npm run ios:publish:cloud  # always EAS
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$(uname -s)" == "Darwin" ]]; then
  exec bash "${SCRIPT_DIR}/build-ios-local.sh" "$@"
fi

echo "[ios] $(uname -s) detected — Xcode is macOS-only, so building on EAS instead."
echo "[ios] This needs an authenticated EAS account ('eas login') and uses build credits."

# `eas` is a global install on the release Macs; fall back to npx so a Linux
# box without it still works (the first run downloads the CLI).
if command -v eas >/dev/null 2>&1; then
  exec eas build -p ios --profile production --submit "$@"
fi

echo "[ios] 'eas' is not on PATH — running it through npx."
exec npx --yes eas-cli build -p ios --profile production --submit "$@"
