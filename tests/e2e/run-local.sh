#!/bin/bash
# run-local.sh - Run E2E tests locally without Docker
#
# Prerequisites:
#   - pinchtab built and in PATH or ./pinchtab
#   - A simple HTTP server for fixtures (python or node)
#
# Usage:
#   ./tests/e2e/run-local.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${NC}"
  [ -n "${PINCHTAB_PID:-}" ] && kill "$PINCHTAB_PID" 2>/dev/null || true
  [ -n "${FIXTURE_PID:-}" ] && kill "$FIXTURE_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Find pinchtab binary
PINCHTAB_BIN=""
if [ -x "$PROJECT_ROOT/pinchtab" ]; then
  PINCHTAB_BIN="$PROJECT_ROOT/pinchtab"
elif command -v pinchtab &>/dev/null; then
  PINCHTAB_BIN="$(command -v pinchtab)"
else
  echo -e "${RED}Error: pinchtab binary not found${NC}"
  echo "Build it first: go build -o pinchtab ./cmd/pinchtab"
  exit 1
fi

echo -e "${GREEN}Using pinchtab: $PINCHTAB_BIN${NC}"

# Start fixture server
FIXTURES_PORT=8765
echo -e "${YELLOW}Starting fixture server on port $FIXTURES_PORT...${NC}"

if command -v python3 &>/dev/null; then
  (cd "$SCRIPT_DIR/fixtures" && python3 -m http.server "$FIXTURES_PORT" &>/dev/null) &
  FIXTURE_PID=$!
elif command -v npx &>/dev/null; then
  (cd "$SCRIPT_DIR/fixtures" && npx serve -l "$FIXTURES_PORT" &>/dev/null) &
  FIXTURE_PID=$!
else
  echo -e "${RED}Error: Need python3 or npx for fixture server${NC}"
  exit 1
fi

sleep 2

# Start pinchtab server
PINCHTAB_PORT=9876
echo -e "${YELLOW}Starting pinchtab on port $PINCHTAB_PORT...${NC}"

PINCHTAB_PORT=$PINCHTAB_PORT PINCHTAB_HEADLESS=true "$PINCHTAB_BIN" server &>/dev/null &
PINCHTAB_PID=$!

# Wait for pinchtab to be ready
for i in {1..30}; do
  if curl -s "http://localhost:$PINCHTAB_PORT/health" &>/dev/null; then
    echo -e "${GREEN}Pinchtab ready${NC}"
    break
  fi
  sleep 1
done

# Check if pinchtab started
if ! curl -s "http://localhost:$PINCHTAB_PORT/health" &>/dev/null; then
  echo -e "${RED}Error: Pinchtab failed to start${NC}"
  exit 1
fi

# Run tests
echo -e "\n${YELLOW}Running E2E tests...${NC}\n"

export PINCHTAB_URL="http://localhost:$PINCHTAB_PORT"
export FIXTURES_URL="http://localhost:$FIXTURES_PORT"
export RESULTS_DIR=""

"$SCRIPT_DIR/scenarios/run-all.sh"
