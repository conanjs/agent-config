#!/usr/bin/env bash
# For macOS and Linux ONLY. On Windows, run install.ps1 instead (this file is
# bash syntax; PowerShell can't execute it, and vice versa — never run both).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/os.sh"

OS="$(detect_os)"
case "$OS" in
  macos) exec "$SCRIPT_DIR/macos/install.sh" ;;
  linux) exec "$SCRIPT_DIR/linux/install.sh" ;;
  windows-bash)
    echo "You're in Git Bash / MSYS / Cygwin on Windows. Use the native Windows installer instead:" >&2
    echo "  powershell -ExecutionPolicy Bypass -File $(cd "$SCRIPT_DIR" && pwd -W 2>/dev/null || echo "$SCRIPT_DIR")\\install.ps1" >&2
    echo "(bash symlinks under Git Bash are unreliable without admin/Developer Mode and aren't what install.ps1's fallback logic covers)" >&2
    exit 1
    ;;
  *)
    echo "Unsupported OS: $(uname -s). No installer for this platform yet." >&2
    exit 1
    ;;
esac
