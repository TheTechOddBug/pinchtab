#!/bin/bash
# 03-snapshot.sh — Accessibility tree and text extraction

source "$(dirname "$0")/common.sh"

# ─────────────────────────────────────────────────────────────────
start_test "pinchtab snap"

pt_post /navigate -d "{\"url\":\"${FIXTURES_URL}/\"}"

pt_get /snapshot
assert_index_page "$RESULT"
assert_json_length_gte "$RESULT" '.nodes' 1

end_test

# ─────────────────────────────────────────────────────────────────
start_test "pinchtab snap (buttons.html)"

pt_post /navigate -d "{\"url\":\"${FIXTURES_URL}/buttons.html\"}"
sleep 1

pt_get /snapshot
assert_buttons_page "$RESULT"

end_test

# ─────────────────────────────────────────────────────────────────
start_test "pinchtab snap (form.html)"

pt_post /navigate -d "{\"url\":\"${FIXTURES_URL}/form.html\"}"
sleep 1

pt_get /snapshot
assert_form_page "$RESULT"

end_test

# ─────────────────────────────────────────────────────────────────
start_test "pinchtab text (table.html)"

pt_post /navigate -d "{\"url\":\"${FIXTURES_URL}/table.html\"}"
sleep 1

TEXT_RESULT=$(curl -s "${PINCHTAB_URL}/text" | jq -r '.text')
assert_table_page "$TEXT_RESULT"

end_test
