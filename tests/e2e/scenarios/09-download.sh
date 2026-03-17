#!/bin/bash
# 09-download.sh — File download
#
# NOTE: Download endpoint has SSRF protection that blocks private IPs.
# In Docker, fixtures resolves to internal IP, so we test with public URLs.

source "$(dirname "$0")/common.sh"

build_download_redirect_url() {
  local target_url="$1"
  local encoded_target
  local attacker_url

  encoded_target=$(jq -rn --arg u "$target_url" '$u|@uri')
  attacker_url="https://httpbin.org/redirect-to?url=${encoded_target}"
  jq -rn --arg u "$attacker_url" '$u|@uri'
}

# ─────────────────────────────────────────────────────────────────
start_test "pinchtab download (public URL)"

# Use a small public file for testing
pt_get "/download?url=https://httpbin.org/robots.txt"
assert_ok "download public"

end_test

# ─────────────────────────────────────────────────────────────────
start_test "pinchtab download (SSRF blocked)"

# Verify internal URLs are blocked (security feature)
pt_get "/download?url=${FIXTURES_URL}/sample.txt"
assert_http_status 400 "download blocked"

# Verify error message mentions blocking
assert_contains "$RESULT" "blocked\|private" "SSRF error message"

end_test

# ─────────────────────────────────────────────────────────────────
start_test "pinchtab download (redirected internal target blocked)"

ATTACKER_URL=$(build_download_redirect_url "http://127.0.0.1:9999/health")
pt_get "/download?url=${ATTACKER_URL}"
assert_http_status 400 "redirected internal target blocked"
assert_contains "$RESULT" "unsafe browser request\|blocked\|private" "redirect SSRF error message"

end_test

# ─────────────────────────────────────────────────────────────────
start_test "pinchtab download --tab <id>"

pt_get /tabs
TAB_ID=$(get_first_tab)

pt_get "/tabs/${TAB_ID}/download?url=https://httpbin.org/robots.txt"
assert_ok "tab download"

end_test
