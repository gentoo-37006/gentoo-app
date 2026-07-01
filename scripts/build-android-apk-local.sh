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
exec eas build -p android --profile release-apk --local "$@"
