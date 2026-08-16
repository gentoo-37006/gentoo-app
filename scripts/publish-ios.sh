#!/usr/bin/env bash
# Build the iOS app with whichever toolchain this machine can run.
#
# Xcode is macOS-only, so a local build is possible on a Mac and nowhere else.
#
#   macOS — build locally and STOP at the .ipa. The upload is a human step in
#           Transporter (see build-ios-local.sh), which skips EAS's submitter
#           queue and lets whoever is at the Mac walk away from it.
#   Linux — build on EAS's macOS workers, download the .ipa here, and upload it
#           to TestFlight with fastlane. Transporter is macOS-only, so there is
#           no hand-off available on Linux; fastlane's iTMSTransporter is the
#           equivalent, and it keeps `release:all` unattended end to end.
#
# `npm run release:all` goes through here so the release works from any machine.
#
# Force one or the other with the explicit scripts:
#   npm run ios:publish        # always local (fails off macOS)
#   npm run ios:publish:cloud  # always EAS, submitted by EAS
#
# Linux upload credentials — an App Store Connect API key (Users and Access ->
# Integrations -> App Store Connect API). Either point at the .p8 directly:
#   ASC_KEY_ID      the key's ID, e.g. ABC123DEFG
#   ASC_ISSUER_ID   the team's issuer UUID
#   ASC_KEY_PATH    path to AuthKey_<ASC_KEY_ID>.p8
# or supply a ready-made fastlane key file:
#   ASC_API_KEY_PATH  path to a fastlane --api_key_path JSON
#
# UPLOADER=eas hands the upload back to EAS's submitter instead of fastlane.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$(uname -s)" == "Darwin" ]]; then
  exec bash "${SCRIPT_DIR}/build-ios-local.sh" "$@"
fi

# fastlane requires a UTF-8 locale and does not fall back gracefully; don't
# depend on the shell's (same reason as build-ios-local.sh).
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

OUT="${OUT:-ios-build/Gentoo.ipa}"
UPLOADER="${UPLOADER:-fastlane}"
# Kept in step with app.json's ios.bundleIdentifier and eas.json's
# submit.production.ios.ascAppId — fastlane needs both to find the right app.
BUNDLE_ID="com.gentoo.app"
ASC_APP_ID="6785305308"

api_key_file=""
api_key_is_temp=0
cleanup() {
  # The generated key file holds the .p8 private key verbatim; never leave it
  # behind, including when the build or upload fails.
  if [[ "$api_key_is_temp" == "1" && -n "$api_key_file" && -f "$api_key_file" ]]; then
    rm -f "$api_key_file"
  fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Preflight. Everything that can fail without Apple's involvement is checked
# BEFORE the build starts: an EAS production build auto-increments the remote
# build number, so dying after it means a burned build number and ~20 wasted
# minutes. Same reasoning as the fastlane/CocoaPods checks in build-ios-local.sh.
# ---------------------------------------------------------------------------
if [[ "$UPLOADER" == "fastlane" ]]; then
  if ! command -v fastlane >/dev/null 2>&1; then
    cat >&2 <<'EOF'
[ios] 'fastlane' not found on PATH — it uploads the .ipa to TestFlight on Linux.

Install it, then rerun:
  sudo apt install ruby-full && sudo gem install fastlane
  # or: brew install fastlane   (Homebrew on Linux)

To let EAS submit the build instead of fastlane:
  UPLOADER=eas npm run ios:publish:auto
EOF
    exit 1
  fi

  if [[ -n "${ASC_API_KEY_PATH:-}" ]]; then
    if [[ ! -f "$ASC_API_KEY_PATH" ]]; then
      echo "[ios] ASC_API_KEY_PATH is set but no file exists there: $ASC_API_KEY_PATH" >&2
      exit 1
    fi
    api_key_file="$ASC_API_KEY_PATH"
  else
    missing=()
    [[ -n "${ASC_KEY_ID:-}" ]] || missing+=(ASC_KEY_ID)
    [[ -n "${ASC_ISSUER_ID:-}" ]] || missing+=(ASC_ISSUER_ID)
    [[ -n "${ASC_KEY_PATH:-}" ]] || missing+=(ASC_KEY_PATH)
    if (( ${#missing[@]} > 0 )); then
      cat >&2 <<EOF
[ios] Missing App Store Connect API credentials: ${missing[*]}

fastlane uploads to TestFlight with an API key rather than an Apple ID, so the
release stays unattended (no 2FA prompt mid-run). Create one under
App Store Connect -> Users and Access -> Integrations -> App Store Connect API,
then export:

  export ASC_KEY_ID=ABC123DEFG
  export ASC_ISSUER_ID=00000000-0000-0000-0000-000000000000
  export ASC_KEY_PATH=~/.appstoreconnect/AuthKey_ABC123DEFG.p8

Already have a fastlane key file? Point at it with ASC_API_KEY_PATH instead.
To let EAS submit the build instead of fastlane:
  UPLOADER=eas npm run ios:publish:auto
EOF
      exit 1
    fi

    if [[ ! -f "$ASC_KEY_PATH" ]]; then
      echo "[ios] ASC_KEY_PATH does not point at a file: $ASC_KEY_PATH" >&2
      exit 1
    fi

    # Written through node so the .p8's newlines are JSON-escaped correctly —
    # a hand-rolled heredoc produces a file fastlane parses but Apple rejects,
    # which only surfaces as an opaque authentication failure after the build.
    api_key_file="$(mktemp "${TMPDIR:-/tmp}/asc-api-key.XXXXXX.json")"
    api_key_is_temp=1
    chmod 600 "$api_key_file"
    ASC_KEY_ID="$ASC_KEY_ID" \
    ASC_ISSUER_ID="$ASC_ISSUER_ID" \
    ASC_KEY_PATH="$ASC_KEY_PATH" \
    node -e '
      const fs = require("fs");
      fs.writeFileSync(
        process.argv[1],
        JSON.stringify({
          key_id: process.env.ASC_KEY_ID,
          issuer_id: process.env.ASC_ISSUER_ID,
          key: fs.readFileSync(process.env.ASC_KEY_PATH, "utf8"),
          in_house: false,
        })
      );
    ' "$api_key_file"
  fi
fi

echo "[ios] $(uname -s) detected — Xcode is macOS-only, so building on EAS instead."
echo "[ios] This needs an authenticated EAS account ('eas login') and uses build credits."

# `eas` is a global install on the release Macs; fall back to npx so a Linux
# box without it still works (the first run downloads the CLI).
if command -v eas >/dev/null 2>&1; then
  eas_cmd=(eas)
else
  echo "[ios] 'eas' is not on PATH — running it through npx."
  eas_cmd=(npx --yes eas-cli)
fi

if [[ "$UPLOADER" == "eas" ]]; then
  echo "[ios] UPLOADER=eas — building and submitting through EAS."
  exec "${eas_cmd[@]}" build -p ios --profile production --submit "$@"
fi

"${eas_cmd[@]}" build -p ios --profile production "$@"

# The cloud build leaves the .ipa on EAS; fastlane needs it on this machine.
# Same artifact lookup as publish-android.sh.
echo "[ios] Fetching the finished .ipa from EAS…"
artifact_url="$(
  "${eas_cmd[@]}" build:list --platform ios --limit 1 --json --non-interactive 2>/dev/null |
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
[ios] Could not read the .ipa URL from EAS.

The build itself may still have succeeded — check
  https://expo.dev/accounts/_/projects/gentoo-app/builds
and download the .ipa to ${OUT}, then upload it with:
  fastlane pilot upload --ipa ${OUT} --app_identifier ${BUNDLE_ID} --apple_id ${ASC_APP_ID}
EOF
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
curl -fL --retry 3 --progress-bar -o "$OUT" "$artifact_url"
echo "[ios] Downloaded $(du -h "$OUT" | cut -f1) to ${OUT}"

IPA_PATH="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"

echo "[ios] Uploading to TestFlight with fastlane…"
# --skip_waiting_for_build_processing: Apple's processing runs for minutes after
# the bytes land and blocks nothing else in release:all. The build shows up in
# TestFlight on its own; waiting here would just hold the terminal open.
fastlane pilot upload \
  --api_key_path "$api_key_file" \
  --app_identifier "$BUNDLE_ID" \
  --apple_id "$ASC_APP_ID" \
  --ipa "$IPA_PATH" \
  --skip_waiting_for_build_processing true

echo "[ios] Uploaded ${IPA_PATH} — it appears in TestFlight once Apple finishes processing."
