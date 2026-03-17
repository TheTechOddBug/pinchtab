#!/bin/bash
# 46-download-ssrf.sh — Download SSRF regression coverage
#
# Covers:
# - direct internal/private targets rejected at initial validation
# - redirected internal targets rejected during browser-side navigation

source "$(dirname "$0")/common.sh"

build_download_redirect_url() {
  local target_url="$1"
  local encoded_target
  local attacker_url

  encoded_target=$(jq -rn --arg u "$target_url" '$u|@uri')
  attacker_url="https://httpbin.org/redirect-to?url=${encoded_target}"
  jq -rn --arg u "$attacker_url" '$u|@uri'
}

start_test "download security: direct internal target blocked"

pt_get "/download?url=${FIXTURES_URL}/sample.txt"
assert_http_status 400 "direct internal target blocked"
assert_contains "$RESULT" "blocked\|private" "direct SSRF error message"

end_test

# ─────────────────────────────────────────────────────────────────
start_test "download security: redirected internal target blocked"

ATTACKER_URL=$(build_download_redirect_url "http://127.0.0.1:9999/health")
pt_get "/download?url=${ATTACKER_URL}"
assert_http_status 400 "redirected internal target blocked"
assert_contains "$RESULT" "unsafe browser request\|blocked\|private" "redirect SSRF error message"

end_test
