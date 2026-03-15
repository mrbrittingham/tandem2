#!/usr/bin/env bash
set -euo pipefail

# If we're root, refresh ld cache (handles the "0-byte /etc/ld.so.cache" situation)
if [ "$(id -u)" -eq 0 ] && command -v ldconfig >/dev/null 2>&1; then
  ldconfig >/dev/null 2>&1 || true
fi

exec "$@"