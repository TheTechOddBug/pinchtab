#!/bin/bash
# 25-press-keys.sh — Verify press action sends actual key events (not text)
#
# Regression test for GitHub issue #236: press action was typing key names
# as literal text instead of dispatching keyboard events.

source "$(dirname "$0")/common.sh"

# Use permissive instance (needs evaluate enabled)
# Previous test (24-tab-eviction-lru) switches to secure and doesn't reset
PINCHTAB_URL="http://pinchtab:9999"

# ─────────────────────────────────────────────────────────────────
start_test "press Enter: submits form (not types 'Enter')"

# Navigate to form fixture
pt_post /navigate -d "{\"url\":\"${FIXTURES_URL}/form.html\"}"
sleep 1

# Type into username field
pt_post /action -d '{"kind":"type","selector":"#username","text":"testuser"}'
assert_ok "type into username"

# Press Enter to submit the form
pt_post /action -d '{"kind":"press","key":"Enter"}'
assert_ok "press Enter"

# Give form submit handler time to execute
sleep 0.5

# Check that "Form submitted!" appears (proves Enter triggered submit)
pt_post /evaluate -d '{"expression":"document.getElementById(\"result\").textContent"}'
RESULT_TEXT=$(echo "$RESULT" | jq -r '.result // empty')
if echo "$RESULT_TEXT" | grep -q "Form submitted"; then
  echo -e "  ${GREEN}✓${NC} form was submitted (Enter key worked)"
  ((ASSERTIONS_PASSED++)) || true
else
  echo -e "  ${RED}✗${NC} form was NOT submitted (result: '$RESULT_TEXT')"
  ((ASSERTIONS_FAILED++)) || true
fi

# Check that username field does NOT contain "Enter" as text
assert_input_not_contains "#username" "Enter" "username should not contain 'Enter' (bug #236)"

end_test

# ─────────────────────────────────────────────────────────────────
start_test "press Tab: moves focus (not types 'Tab')"

# Navigate fresh
pt_post /navigate -d "{\"url\":\"${FIXTURES_URL}/form.html\"}"
sleep 1

# Focus on username and type
pt_post /action -d '{"kind":"click","selector":"#username"}'
pt_post /action -d '{"kind":"type","selector":"#username","text":"hello"}'
assert_ok "type hello"

# Press Tab to move to next field
pt_post /action -d '{"kind":"press","key":"Tab"}'
assert_ok "press Tab"

# Verify username doesn't contain "Tab" text
assert_input_not_contains "#username" "Tab" "username should not contain 'Tab' (bug #236)"

end_test
