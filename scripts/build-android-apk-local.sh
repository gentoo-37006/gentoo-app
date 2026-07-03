#!/usr/bin/env bash
set -euo pipefail

java_home_cmd="/usr/libexec/java_home"

java_major() {
  "$1/bin/java" -version 2>&1 | awk -F '[." ]+' '/version/ { print $3; exit }'
}

is_supported_java_home() {
  local home="$1"
  local major
  major="$(java_major "$home")"
  [[ "$major" == "17" || "$major" == "21" ]]
}

find_supported_java_home() {
  local requested home
  local homebrew_home_candidates=(
    "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
    "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  )

  for home in "${homebrew_home_candidates[@]}"; do
    if [[ -x "$home/bin/java" && "$(java_major "$home")" == "21" ]]; then
      echo "$home"
      return 0
    fi
  done

  for requested in 21 17; do
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
    cat >&2 <<'EOF'
No supported local Android build JDK was found.

Install an LTS JDK, then rerun this command:
  brew install --cask temurin@21

Your current Java is likely too new for this Android Gradle build.
EOF
    exit 1
  fi
fi

echo "Using JAVA_HOME=$JAVA_HOME"

# Android SDK: auto-detect the standard location when ANDROID_HOME isn't set.
if [[ -z "${ANDROID_HOME:-}" ]]; then
  if [[ -d "$HOME/Library/Android/sdk" ]]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  else
    cat >&2 <<'EOF'
No Android SDK found (ANDROID_HOME unset, ~/Library/Android/sdk missing).

One-time setup:
  brew install --cask android-commandlinetools
  yes | sdkmanager --licenses --sdk_root="$HOME/Library/Android/sdk"
  yes | sdkmanager --sdk_root="$HOME/Library/Android/sdk" platform-tools
EOF
    exit 1
  fi
fi
echo "Using ANDROID_HOME=$ANDROID_HOME"

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
