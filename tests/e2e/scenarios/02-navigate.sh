#!/bin/bash
# 02-navigate.sh — Navigation and tab management

source "$(dirname "$0")/common.sh"

# ─────────────────────────────────────────────────────────────────
start_test "pinchtab nav <url>"

pt_post /navigate -d "{\"url\":\"${FIXTURES_URL}/\"}"
assert_json_contains "$RESULT" '.title' 'E2E Test'
assert_json_contains "$RESULT" '.url' 'fixtures'

end_test

# ─────────────────────────────────────────────────────────────────
start_test "pinchtab nav (multiple pages)"

pt_post /navigate -d "{\"url\":\"${FIXTURES_URL}/form.html\"}"
assert_json_contains "$RESULT" '.title' 'Form'

pt_post /navigate -d "{\"url\":\"${FIXTURES_URL}/table.html\"}"
assert_json_contains "$RESULT" '.title' 'Table'

end_test

# ─────────────────────────────────────────────────────────────────
start_test "pinchtab tabs"

assert_tab_count_gte 2

end_test
