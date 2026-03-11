# MCP Tool Reference

Complete parameter reference for all 21 tools exposed by the PinchTab MCP server.

All tool names are prefixed with `pinchtab_`. The server communicates over **stdio JSON-RPC 2.0** (MCP spec 2025-11-25).

---

## Navigation

### pinchtab_navigate

Navigate the browser to a URL.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `url` | string | **Yes** | Full URL including scheme (`http://` or `https://`) |
| `tabId` | string | No | Target tab. Uses current tab if omitted. |

**Returns:** JSON object with `tabId`, `url`, and `title`.

```json
{ "tabId": "abc123", "url": "https://example.com", "title": "Example Domain" }
```

---

### pinchtab_snapshot

Get an accessibility tree snapshot of the current page. This is the primary way agents understand page structure and discover interactive element refs.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `tabId` | string | No | Target tab |
| `interactive` | boolean | No | Only return interactive elements (buttons, links, inputs) |
| `compact` | boolean | No | Compact format — uses fewer tokens |
| `diff` | boolean | No | Only changes since the last snapshot |
| `selector` | string | No | CSS selector to scope the snapshot to a subtree |

**Returns:** Accessibility tree as text. Element refs (e.g. `e5`, `e12`) are used in interaction tool calls.

---

### pinchtab_screenshot

Capture a screenshot of the current page.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `tabId` | string | No | Target tab |
| `quality` | number | No | JPEG quality 0–100 (default PNG) |

**Returns:** Base64-encoded image string.

---

### pinchtab_get_text

Extract readable text content from the page, suitable for summarisation and Q&A.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `tabId` | string | No | Target tab |
| `raw` | boolean | No | Return raw text without formatting |

**Returns:** Plain text string.

---

## Interaction

All interaction tools that target page elements require a `ref` — the element identifier from a `pinchtab_snapshot` response (e.g. `e5`).

### pinchtab_click

Click an element by its accessibility ref.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `ref` | string | **Yes** | Element ref from snapshot (e.g. `e5`) |
| `tabId` | string | No | Target tab |

---

### pinchtab_type

Type text into an input element, simulating keystrokes.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `ref` | string | **Yes** | Element ref |
| `text` | string | **Yes** | Text to type |
| `tabId` | string | No | Target tab |

---

### pinchtab_press

Press a named keyboard key.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `key` | string | **Yes** | Key name: `Enter`, `Tab`, `Escape`, `ArrowDown`, `Backspace`, etc. |
| `tabId` | string | No | Target tab |

---

### pinchtab_hover

Hover the mouse over an element (triggers `:hover` styles and tooltips).

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `ref` | string | **Yes** | Element ref |
| `tabId` | string | No | Target tab |

---

### pinchtab_focus

Give keyboard focus to an element.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `ref` | string | **Yes** | Element ref |
| `tabId` | string | No | Target tab |

---

### pinchtab_select

Select an option from a `<select>` dropdown.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `ref` | string | **Yes** | `<select>` element ref |
| `value` | string | **Yes** | Option value to select |
| `tabId` | string | No | Target tab |

---

### pinchtab_scroll

Scroll the page or a specific element.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `ref` | string | No | Element ref. Omit to scroll the whole page. |
| `pixels` | number | No | Pixels to scroll. Positive = down/right, negative = up/left. Default 300. |
| `tabId` | string | No | Target tab |

---

### pinchtab_fill

Fill an input field using JavaScript event dispatch. Works with React, Vue, Angular, and other frameworks that intercept native input events.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `ref` | string | **Yes** | Element ref or CSS selector |
| `value` | string | **Yes** | Value to set |
| `tabId` | string | No | Target tab |

> **Tip:** Use `pinchtab_fill` instead of `pinchtab_type` when the page uses a frontend framework that does not react to raw keystroke simulation.

---

## Content

### pinchtab_eval

Execute a JavaScript expression in the browser context and return the result.

> **Security note:** Requires `security.allowEvaluate: true` in the PinchTab config. Returns HTTP 403 by default.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `expression` | string | **Yes** | JavaScript expression to evaluate |
| `tabId` | string | No | Target tab |

**Returns:** JSON-serialised result of the expression.

```javascript
// Example expressions
"document.title"
"document.querySelectorAll('a').length"
"window.location.href"
```

---

### pinchtab_pdf

Export the current page as a PDF document.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `tabId` | string | No | Target tab |
| `landscape` | boolean | No | Landscape orientation (default portrait) |
| `scale` | number | No | Print scale 0.1–2.0 (default 1.0) |
| `pageRanges` | string | No | Pages to include, e.g. `"1-3,5"` |

**Returns:** Base64-encoded PDF bytes.

---

### pinchtab_find

Find elements by text content or CSS selector using semantic matching.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `query` | string | **Yes** | Text content or CSS selector |
| `tabId` | string | No | Target tab |

**Returns:** List of matching elements with their refs, text, and positions.

---

## Tab Management

### pinchtab_list_tabs

List all open browser tabs.

No parameters.

**Returns:** Array of tab objects with `tabId`, `url`, and `title`.

---

### pinchtab_close_tab

Close a browser tab.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `tabId` | string | No | Tab to close. Closes the current tab if omitted. |

---

### pinchtab_health

Check whether the PinchTab server is reachable and healthy.

No parameters.

**Returns:** `{"status":"ok"}` on success.

---

### pinchtab_cookies

Get cookies for the current page.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `tabId` | string | No | Target tab |

**Returns:** Array of cookie objects (name, value, domain, path, etc.).

---

## Utility

### pinchtab_wait

Wait for a fixed duration. Use sparingly — prefer `pinchtab_wait_for_selector` when possible.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `ms` | number | **Yes** | Milliseconds to wait. Maximum 30000. |

---

### pinchtab_wait_for_selector

Wait for a CSS selector to appear on the page. Polls every 250 ms.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `selector` | string | **Yes** | CSS selector to wait for |
| `timeout` | number | No | Timeout in milliseconds. Default 10000, maximum 30000. |
| `tabId` | string | No | Target tab |

**Returns:** `{"present": true}` when the selector is found, `{"present": false}` on timeout.

---

## Error Responses

All tools return errors as MCP tool errors (not Go-level errors). Common error patterns:

| Situation | Response |
|-----------|----------|
| PinchTab not running | Connection refused error |
| Element ref not found | `HTTP 500: ref not found` |
| `pinchtab_eval` without security flag | `HTTP 403: evaluate not allowed` |
| Invalid URL in navigate | `invalid URL: must start with http:// or https://` |
| Required parameter missing | Parameter validation error from MCP SDK |

---

## Related Pages

- [MCP User Guide](../mcp.md)
- [MCP Architecture](../architecture/mcp.md)
- [Security Guide](../guides/security.md)
