#!/bin/bash
# ==============================================================================
# LinuxWatch Agent Launcher
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/linuxwatch-backend"

echo "========================================================"
echo " Starting LinuxWatch Agent... "
echo "========================================================"

cd "$SCRIPT_DIR/linuxwatch-agent"

if [[ -f config.env ]]; then
  exec python3 Agent.py --config config.env "$@"
fi

if [[ -z "${JWT_TOKEN:-}" ]]; then
  echo "Set JWT_TOKEN or create linuxwatch-agent/config.env before starting the agent." >&2
  exit 1
fi

exec python3 Agent.py "$@"
