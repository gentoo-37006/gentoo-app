#!/usr/bin/env bash
# Build the release APK locally. Needs a JDK 17/21 and the Android SDK.
#
# `--check` runs only the toolchain detection and exits 0 when a local build is
# possible — publish-android.sh uses it to decide between building here and
# building on EAS. It deliberately stops before touching ~/.gradle.
set -euo pipefail

CHECK_ONLY=0
if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=1
  shift
fi

java_home_cmd="/usr/libexec/java_home" # macOS only; absent elsewhere

java_major() {
  "$1/bin/java" -version 2>&1 | awk -F '[." ]+' '/version/ { print $3; exit }'
}

is_supported_java_home() {
  local home="$1"
  local major
  major="$(java_major "$home")"
  [[ "$major" == "17" || "$major" == "21" ]]
}

# Every tree a JDK is normally installed into: Homebrew (macOS), the distro
# package manager and SDKMAN (Linux). Unmatched globs simply fail the -x test.
jdk_search_paths() {
  printf '%s\n' \
    "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" \
    "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" \
    "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" \
    "/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" \
    /usr/lib/jvm/*/ \
    /usr/local/lib/jvm/*/ \
    "$HOME"/.sdkman/candidates/java/*/
}

find_supported_java_home() {
  local requested home

  # Newest supported JDK first, so a box with both 17 and 21 uses 21.
  for requested in 21 17; do
    while IFS= read -r home; do
      home="${home%/}"
      [[ -x "$home/bin/java" ]] || continue
      [[ "$(java_major "$home")" == "$requested" ]] || continue
      echo "$home"
      return 0
    done < <(jdk_search_paths)

    if [[ -x "$java_home_cmd" ]]; then
      home="$("$java_home_cmd" -v "$requested" 2>/dev/null || true)"
      if [[ -n "$home" && -x "$home/bin/java" && "$(java_major "$home")" == "$requested" ]]; then
        echo "$home"
        return 0
      fi
    fi
  done

  return 1
}

if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
  if ! is_supported_java_home "$JAVA_HOME"; then
    echo "JAVA_HOME points to unsupported Java $(java_major "$JAVA_HOME"): $JAVA_HOME" >&2
    unset JAVA_HOME
  fi
fi

if [[ -z "${JAVA_HOME:-}" ]]; then
  supported_java_home="$(find_supported_java_home || true)"
  if [[ -n "$supported_java_home" ]]; then
    export JAVA_HOME="$supported_java_home"
  else
    echo "No supported local Android build JDK was found (needs 21 or 17)." >&2
    echo >&2
    echo "Install an LTS JDK, then rerun this command:" >&2
    if [[ "$(uname -s)" == "Darwin" ]]; then
      echo "  brew install --cask temurin@21" >&2
    else
      echo "  sudo apt install openjdk-21-jdk      # or: sdk install java 21-tem" >&2
    fi
    echo >&2
    echo "A newer Java (25+) is not usable by this Android Gradle build." >&2
    echo "Or skip the local toolchain entirely: npm run android:apk:cloud" >&2
    exit 1
  fi
fi

echo "Using JAVA_HOME=$JAVA_HOME"

# Android SDK: auto-detect the standard location when ANDROID_HOME isn't set.
if [[ -z "${ANDROID_HOME:-}" ]]; then
  # macOS keeps the SDK under ~/Library; Linux (and Android Studio there) uses
  # ~/Android/Sdk. ANDROID_SDK_ROOT is the modern spelling of the same thing.
  for sdk_candidate in \
    "${ANDROID_SDK_ROOT:-}" \
    "$HOME/Library/Android/sdk" \
    "$HOME/Android/Sdk" \
    "$HOME/.android/sdk"; do
    if [[ -n "$sdk_candidate" && -d "$sdk_candidate" ]]; then
      export ANDROID_HOME="$sdk_candidate"
      break
    fi
  done
fi

if [[ -z "${ANDROID_HOME:-}" ]]; then
  sdk_dir="$HOME/Android/Sdk"
  [[ "$(uname -s)" == "Darwin" ]] && sdk_dir="$HOME/Library/Android/sdk"
  echo "No Android SDK found (ANDROID_HOME unset, no SDK at $sdk_dir)." >&2
  echo >&2
  echo "One-time setup:" >&2
  if [[ "$(uname -s)" == "Darwin" ]]; then
    echo "  brew install --cask android-commandlinetools" >&2
  else
    echo "  sudo apt install android-sdk   # or unzip Google's commandlinetools" >&2
  fi
  echo "  yes | sdkmanager --licenses --sdk_root=\"$sdk_dir\"" >&2
  echo "  yes | sdkmanager --sdk_root=\"$sdk_dir\" platform-tools" >&2
  echo >&2
  echo "Or skip the local toolchain entirely: npm run android:apk:cloud" >&2
  exit 1
fi
echo "Using ANDROID_HOME=$ANDROID_HOME"

if [[ "$CHECK_ONLY" == "1" ]]; then
  echo "Local Android toolchain is usable."
  exit 0
fi

# The RN gradle plugin compiles with a Java 17 toolchain. Expose every local
# JDK to Gradle and disable toolchain auto-download: without a matching local
# JDK, Gradle 9 would invoke the bundled foojay resolver, which crashes with
# "JvmVendorSpec ... IBM_SEMERU" (removed in Gradle 9). These must live in
# ~/.gradle/gradle.properties — GRADLE_OPTS system properties don't reach the
# daemon, and EAS runs gradlew itself so CLI flags aren't an option.
jdk_paths="$JAVA_HOME"
for extra in \
  "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" \
  "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"; do
  if [[ -x "$extra/bin/java" && "$extra" != "$JAVA_HOME" ]]; then
    jdk_paths="$jdk_paths,$extra"
  fi
done
gradle_props="$HOME/.gradle/gradle.properties"
mkdir -p "$HOME/.gradle"
touch "$gradle_props"
grep -v '^org\.gradle\.java\.installations\.' "$gradle_props" > "$gradle_props.tmp" || true
mv "$gradle_props.tmp" "$gradle_props"
{
  echo "org.gradle.java.installations.auto-download=false"
  echo "org.gradle.java.installations.paths=$jdk_paths"
} >> "$gradle_props"
echo "Configured Gradle toolchains in $gradle_props (paths: $jdk_paths)"

mkdir -p android-build
exec eas build -p android --profile release-apk --local --output android-build/Gentoo.apk "$@"
