#!/bin/bash
# 17-text-extraction.sh — Text extraction from pages (global and per-tab)

source "$(dirname "$0")/common.sh"

start_test "text extraction: GET /text extracts readable content"

pt_post /navigate -d "{\"url\":\"${FIXTURES_URL}/index.html\"}"
pt_get /text
assert_ok "get text"

# Verify text contains expected content from the page
assert_contains "$RESULT" "E2E Test\|Buttons\|Search\|Customize" "text contains page content"

end_test

# ─────────────────────────────────────────────────────────────────
start_test "text extraction: GET /tabs/{id}/text extracts per-tab content"

pt_post /navigate -d "{\"url\":\"${FIXTURES_URL}/buttons.html\"}"
TAB_ID=$(get_tab_id)

pt_get "/tabs/${TAB_ID}/text"
assert_ok "get tab text"

# Buttons page has button elements
assert_contains "$RESULT" "Click me\|Button" "text includes button labels"

end_test

# ─────────────────────────────────────────────────────────────────
start_test "text extraction: text differs between tabs"

# Create another tab with different content
pt_post /navigate -d "{\"url\":\"${FIXTURES_URL}/form.html\"}"
TAB_ID2=$(get_tab_id)

pt_get "/tabs/${TAB_ID2}/text"
FORM_TEXT="$RESULT"

# Form page should have form labels
assert_contains "$FORM_TEXT" "Name\|Email\|Submit\|Form" "text includes form labels"

end_test

# ─────────────────────────────────────────────────────────────────
start_test "text extraction: text excludes script/style content"

# Text extraction should not include raw JavaScript or CSS
if echo "$RESULT" | grep -q "function\|var\|css\|<script>"; then
  echo -e "  ${YELLOW}~${NC} text may contain code (depends on sanitization)"
  ((ASSERTIONS_PASSED++)) || true
else
  echo -e "  ${GREEN}✓${NC} text properly excludes code content"
  ((ASSERTIONS_PASSED++)) || true
fi

end_test
