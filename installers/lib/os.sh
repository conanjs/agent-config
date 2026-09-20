#!/usr/bin/env bash
# OS detection helper. Sourced by install.sh.

detect_os() {
  case "$(uname -s)" in
    Darwin)            echo "macos" ;;
    Linux)              echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows-bash" ;; # Git Bash / MSYS2 / Cygwin on Windows
    *)                  echo "unknown" ;;
  esac
}
