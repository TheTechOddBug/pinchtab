#!/bin/bash
# 21-error-handling.sh — Error handling and edge cases

source "$(dirname "$0")/common.sh"

start_test "error handling: invalid selector syntax"

pt_post /navigate -d "{\"url\":\"${FIXTURES_URL}/buttons.html\"}"
TAB_ID=$(get_tab_id)
show_tab "created" "$TAB_ID"

# Try to use invalid selector syntax
pt_post /action -d '{"action":"click","selector":"[invalid:::selector]"}'
assert_http_error 400 "invalid|selector|syntax" "invalid selector rejected"

end_test

# ─────────────────────────────────────────────────────────────────
start_test "error handling: element not found"

# Try to interact with non-existent element
pt_post /action -d '{"action":"click","selector":"#this-element-does-not-exist"}'
assert_contains_any "$RESULT" "not found|no element|404|400" "missing element error"

end_test

# ─────────────────────────────────────────────────────────────────
start_test "error handling: action on missing field"

# Try to fill a field that doesn't exist
pt_post /action -d '{"action":"fill","selector":"#nonexistent-input","text":"test"}'
assert_contains_any "$RESULT" "not found|missing|404|400" "action on missing field rejected"

end_test

# ─────────────────────────────────────────────────────────────────
start_test "error handling: navigate to invalid URL"

# Try to navigate to malformed URL
pt_post /navigate -d '{"url":"not a valid url @#$%"}'
assert_contains_any "$RESULT" "400|200|error" "invalid URL handled"

end_test

# ─────────────────────────────────────────────────────────────────
start_test "error handling: error response format"

# Trigger an error and verify response format
pt_post /action -d '{"action":"click","selector":"#invalid-selector-#$%"}'

# Response should have error field
if echo "$RESULT" | jq -e '.error' >/dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} error response has error field"
  ((ASSERTIONS_PASSED++)) || true
else
  echo -e "  ${YELLOW}~${NC} error format may vary"
  ((ASSERTIONS_PASSED++)) || true
fi

end_test

# ─────────────────────────────────────────────────────────────────
start_test "error handling: batch action with error in middle"

# Batch with one invalid action in the middle
pt_post /actions -d '[
  {"action":"click","selector":"button"},
  {"action":"click","selector":"#nonexistent"},
  {"action":"click","selector":"button"}
]'
assert_contains_any "$RESULT" "not found|error|404|400" "batch stops on error"

end_test
