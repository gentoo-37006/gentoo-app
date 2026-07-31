#!/usr/bin/env bash
# Build the release APK with whichever toolchain this machine can run.
#
# A local build needs a JDK 17/21 plus the Android SDK. When they're present
# this just runs the local build; when they aren't (a fresh Linux box, CI) it
# builds on EAS and downloads the APK to the same path, so `release:collect`
# finds an artifact either way and `npm run release:all` completes anywhere.
#
# Force one or the other with the explicit scripts:
#   npm run android:apk        # always local (fails without the toolchain)
#   npm run android:apk:cloud  # always EAS (leaves the APK on EAS)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${OUT:-android-build/Gentoo.apk}"

if bash "${SCRIPT_DIR}/build-android-apk-local.sh" --check >/dev/null 2>&1; then
  exec bash "${SCRIPT_DIR}/build-android-apk-local.sh" "$@"
fi

echo "[android] No local Android toolchain (JDK 17/21 + SDK) — building on EAS instead."
echo "[android] This needs an authenticated EAS account ('eas login') and uses build credits."
bash "${SCRIPT_DIR}/build-android-apk-local.sh" --check 2>&1 | sed 's/^/[android]   /' || true

# `eas` is a global install on the release machines; fall back to npx elsewhere.
if command -v eas >/dev/null 2>&1; then
  eas_cmd=(eas)
else
  echo "[android] 'eas' is not on PATH — running it through npx."
  eas_cmd=(npx --yes eas-cli)
fi

# Interactive on purpose: the first Android cloud build may need to generate a
# keystore, which cannot happen in --non-interactive mode.
"${eas_cmd[@]}" build -p android --profile release-apk "$@"

# The cloud build leaves the APK on EAS, but release:collect expects it here.
echo "[android] Fetching the finished APK from EAS…"
artifact_url="$(
  "${eas_cmd[@]}" build:list --platform android --limit 1 --json --non-interactive 2>/dev/null |
    node -e '
      let raw = "";
      process.stdin.on("data", (c) => (raw += c));
      process.stdin.on("end", () => {
        const build = (JSON.parse(raw || "[]"))[0];
        if (!build || build.status !== "FINISHED") process.exit(1);
        process.stdout.write(build.artifacts?.buildUrl ?? "");
      });
    '
)" || true

if [[ -z "$artifact_url" ]]; then
  cat >&2 <<EOF
[android] Could not read the APK URL from EAS.

The build itself may still have succeeded — check
  https://expo.dev/accounts/_/projects/gentoo-app/builds
and download the APK to ${OUT}, then run: npm run release:collect
EOF
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
curl -fL --retry 3 --progress-bar -o "$OUT" "$artifact_url"
echo "[android] Downloaded $(du -h "$OUT" | cut -f1) to ${OUT}"
