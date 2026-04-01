# PR: Standardize Selected API Errors with RFC 7807 Problem Details

## Title
Adopt RFC 7807 `application/problem+json` for streamed capability/precondition failures and websocket proxy pre-upgrade errors

## Summary
This PR introduces a shared `Problem` response helper and migrates a focused set of inconsistent plain-text API failures to RFC 7807-style Problem Details responses.

The rollout is intentionally incremental to avoid breaking existing clients that still parse legacy `application/json` error payloads.

## Why
PinchTab currently returns mixed error formats across endpoints:
- legacy JSON payloads (via `httpx.Error`/`httpx.ErrorCode`)
- plain-text responses via `http.Error` in several API paths

This inconsistency makes client-side error handling fragile and complicates schema-driven integration.

## Scope
### Added
- Shared Problem Details type and writer helper:
  - `internal/httpx/httpx.go`
  - `type ProblemDetails`
  - `func Problem(...)`

### Migrated to Problem Details
- Websocket proxy pre-upgrade failures:
  - `internal/handlers/proxy_ws.go`
  - `invalid_backend_target` (502)
  - `backend_unavailable` (502)
  - `hijack_unsupported` (500)

- Screencast precondition failure:
  - `internal/handlers/screencast.go`
  - `tab_not_found` (404)

- Network stream capability failure:
  - `internal/handlers/network.go`
  - `streaming_not_supported` (500)

- Dashboard SSE capability failures:
  - `internal/dashboard/dashboard.go`
  - `streaming_not_supported` (500)
  - `streaming_deadline_unsupported` (500)

- Orchestrator logs SSE capability failures:
  - `internal/orchestrator/handlers_instances.go`
  - `streaming_not_supported` (500)
  - `streaming_deadline_unsupported` (500)

### Tests Added/Updated
- `internal/httpx/httpx_test.go`
  - `TestProblem`

- `internal/handlers/network_test.go`
  - `TestHandleNetworkStream_StreamingNotSupportedReturnsProblem`

- `internal/handlers/screencast_test.go`
  - `TestHandleScreencast_TabNotFoundReturnsProblem`

- `internal/dashboard/dashboard_test.go`
  - `TestDashboardHandleSSE_StreamingNotSupportedReturnsProblem`
  - `TestDashboardHandleSSE_StreamingDeadlineUnsupportedReturnsProblem`

- `internal/orchestrator/handlers_instances_stream_test.go`
  - `TestHandleLogsStreamByID_StreamingNotSupportedReturnsProblem`
  - `TestHandleLogsStreamByID_StreamingDeadlineUnsupportedReturnsProblem`

### Docs
- `docs/endpoints.md`
  - Added an "Error Response Format" section documenting transition-state behavior:
    - legacy `application/json`
    - RFC 7807 `application/problem+json`

## Behavior Changes
### Before
Some of the above failure paths returned plain-text bodies from `http.Error`.

### After
Those paths now return:
- `Content-Type: application/problem+json`
- RFC 7807-style payload (with project-specific extension fields):
  - `type`
  - `title`
  - `status`
  - `detail`
  - `code`
  - optional `retryable`
  - optional `details`

## Backward Compatibility
- This PR does **not** replace legacy JSON errors globally.
- Existing `httpx.Error` / `httpx.ErrorCode` responses remain unchanged for non-migrated endpoints.
- Client integrations should parse errors based on `Content-Type` during this migration window.

## Validation
### Targeted package tests (fresh run, no cache)
```bash
go test -count=1 ./internal/httpx ./internal/handlers ./internal/dashboard ./internal/orchestrator
```
Result: pass

### Additional targeted regression run
```bash
go test ./internal/handlers ./internal/dashboard ./internal/orchestrator
```
Result: pass

### Full-suite note
A previous `go test ./...` run encountered environment-level Windows Application Control execution blocks for some temp test binaries in unrelated packages. This is not caused by this PR's code changes.

## Risk Assessment
### Low-to-moderate API contract risk
- Risk: clients hard-coded to plain-text parsing on migrated endpoints
- Mitigation:
  - narrow migration scope
  - explicit docs update in `docs/endpoints.md`
  - preserve legacy JSON paths outside migrated set

### Operational risk
- Minimal: changes are response-shape-only on failure branches and do not alter success paths.

## Follow-ups (recommended)
1. Introduce a central compatibility strategy for eventual convergence (legacy + problem details under one abstraction).
2. Migrate additional high-traffic API error paths incrementally with endpoint-level tests.
3. Add OpenAPI error schema annotations for `application/problem+json` where applicable.

## Reviewer Checklist
- [ ] Confirm migrated endpoints now return `application/problem+json` on targeted failures
- [ ] Confirm problem payload includes expected `code` values
- [ ] Confirm no regressions in stream success behavior
- [ ] Confirm docs reflect transition-state error behavior

---

## GitHub PR Body (Detailed, Ready to Paste)

### What changed
This PR introduces a shared RFC 7807-style Problem Details writer and replaces selected plain-text `http.Error` responses with `application/problem+json` payloads.

### Endpoint impact matrix

| Area | File | Condition | Status | Code | Content-Type |
|---|---|---|---:|---|---|
| WS proxy | `internal/handlers/proxy_ws.go` | invalid backend target | 502 | `invalid_backend_target` | `application/problem+json` |
| WS proxy | `internal/handlers/proxy_ws.go` | backend dial unavailable | 502 | `backend_unavailable` | `application/problem+json` |
| WS proxy | `internal/handlers/proxy_ws.go` | hijack unsupported | 500 | `hijack_unsupported` | `application/problem+json` |
| Screencast | `internal/handlers/screencast.go` | tab context not found | 404 | `tab_not_found` | `application/problem+json` |
| Network SSE | `internal/handlers/network.go` | writer does not support stream flush | 500 | `streaming_not_supported` | `application/problem+json` |
| Dashboard SSE | `internal/dashboard/dashboard.go` | writer does not support stream flush | 500 | `streaming_not_supported` | `application/problem+json` |
| Dashboard SSE | `internal/dashboard/dashboard.go` | write deadline control unsupported | 500 | `streaming_deadline_unsupported` | `application/problem+json` |
| Orchestrator logs SSE | `internal/orchestrator/handlers_instances.go` | writer does not support stream flush | 500 | `streaming_not_supported` | `application/problem+json` |
| Orchestrator logs SSE | `internal/orchestrator/handlers_instances.go` | write deadline control unsupported | 500 | `streaming_deadline_unsupported` | `application/problem+json` |

### Shared helper introduced
- Added `ProblemDetails` and `Problem(...)` in `internal/httpx/httpx.go`.
- Payload is sanitized via existing `SanitizeErrorMessage(...)` path.
- The helper sets `Content-Type: application/problem+json` and emits:
  - `type`
  - `title`
  - `status`
  - `detail`
  - optional extension fields `code`, `retryable`, `details`

### Before/after example

Before:
```http
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8

streaming not supported
```

After:
```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json

{
  "type": "about:blank",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "streaming not supported",
  "code": "streaming_not_supported"
}
```

### Test coverage added
- `internal/httpx/httpx_test.go`
  - `TestProblem`
- `internal/handlers/network_test.go`
  - `TestHandleNetworkStream_StreamingNotSupportedReturnsProblem`
- `internal/handlers/screencast_test.go`
  - `TestHandleScreencast_TabNotFoundReturnsProblem`
- `internal/dashboard/dashboard_test.go`
  - `TestDashboardHandleSSE_StreamingNotSupportedReturnsProblem`
  - `TestDashboardHandleSSE_StreamingDeadlineUnsupportedReturnsProblem`
- `internal/orchestrator/handlers_instances_stream_test.go`
  - `TestHandleLogsStreamByID_StreamingNotSupportedReturnsProblem`
  - `TestHandleLogsStreamByID_StreamingDeadlineUnsupportedReturnsProblem`

### Validation run commands and result
```bash
go test -count=1 ./internal/httpx ./internal/handlers ./internal/dashboard ./internal/orchestrator
```
Result: pass

```bash
go test ./internal/handlers ./internal/dashboard ./internal/orchestrator
```
Result: pass

### Compatibility and rollout notes
- This PR intentionally does not replace all legacy error responses.
- Existing `httpx.Error` / `httpx.ErrorCode` behavior remains for non-migrated paths.
- During migration, clients should parse error payloads by `Content-Type`.

### Rollback strategy
- If integration issues are found, rollback is low risk:
  - revert handler callsites from `httpx.Problem(...)` back to previous behavior in the listed files
  - keep helper code in `internal/httpx/httpx.go` if desired (unused helper is safe)

### Risks
- Primary risk: clients that assumed plain-text errors on these exact endpoints.
- Mitigations:
  - small, targeted migration surface
  - explicit docs update in `docs/endpoints.md`
  - direct endpoint-level tests for each migrated capability path
