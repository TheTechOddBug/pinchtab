# MCP Server Architecture

This page describes how the PinchTab MCP server is structured internally and how it integrates with the rest of the stack.

## Overview

The MCP server is a thin stdio-based JSON-RPC 2.0 layer. It runs as a separate process (`pinchtab mcp`) and delegates every browser action to an already-running PinchTab instance via its REST API.

```mermaid
flowchart LR
    A["AI Agent\n(Claude, Copilot, Cursor…)"] -- "stdio / JSON-RPC 2.0" --> M["pinchtab mcp"]
    M -- "HTTP / REST" --> P["PinchTab Server\nor Bridge"]
    P -- "Chrome DevTools Protocol" --> C["Chrome"]
```

Key design decisions:

- **No direct Chrome dependency** — the MCP process has no CDP connection. All browser work is delegated to the PinchTab instance.
- **Any deployment works** — point `PINCHTAB_URL` at a local server, a Docker container, or a remote host.
- **Stateless protocol layer** — the MCP server holds no browser state itself; it is purely a translation adapter.

## Transport

The MCP server uses the **stdio transport** defined in the [MCP specification 2025-11-25](https://spec.modelcontextprotocol.io/). The AI client writes JSON-RPC requests to stdin and reads responses from stdout. Logs and diagnostics go to stderr.

This transport is universally supported by MCP clients (Claude Desktop, VS Code, Cursor, and any SDK-based client).

## Process Model

```
pinchtab mcp
  │
  ├── reads PINCHTAB_URL  (env or config, default http://127.0.0.1:9867)
  ├── reads PINCHTAB_TOKEN (env or config)
  │
  ├── creates internal/mcp.Client  (HTTP client with 120 s timeout)
  ├── registers 21 MCP tools via mcp-go SDK
  └── calls server.ServeStdio()  (blocking read loop)
```

The process exits when stdin is closed by the client.

## Code Layout

```
internal/mcp/
├── server.go      # NewServer() wires tools → handlers; Serve() starts stdio
├── tools.go       # allTools() — JSON-schema tool definitions for all 21 tools
├── handlers.go    # handlerMap() — one handler closure per tool
└── client.go      # Client — thin HTTP wrapper for PinchTab REST API

cmd/pinchtab/
└── cmd_mcp.go     # runMCP() — reads config, calls mcp.Serve()
```

### server.go

`NewServer` creates an `MCPServer` via the `mcp-go` SDK, iterates `allTools()`, looks up the matching handler in `handlerMap`, and calls `s.AddTool`. A panic fires at startup if a tool has no handler, preventing silent gaps.

`Serve` wraps `server.ServeStdio` for the normal execution path.

### tools.go

`allTools` returns a `[]mcp.Tool` slice. Each tool is declared with:

- a name (`pinchtab_*`)
- a human-readable description used by the LLM to select the right tool
- typed parameter schemas with `Required()` / `Description()` annotations

The declarations are grouped by category: Navigation, Interaction, Content, Tab Management, Utility.

### handlers.go

Each handler is a factory function returning a `func(context.Context, mcp.CallToolRequest) (*mcp.CallToolResult, error)` closure. Handlers:

1. Extract and validate arguments from `r.GetArguments()`
2. Build the corresponding PinchTab REST payload
3. Call `c.Get` or `c.Post` with the request context
4. Return `mcp.NewToolResultText` on success or `mcp.NewToolResultError` on HTTP 4xx/5xx

The context passed from the MCP SDK carries the client's deadline, so long-running navigations will be cancelled if the client disconnects.

### client.go

`Client` wraps `net/http` with:

- a 120-second timeout (covers page loads and PDF exports)
- optional `Authorization: Bearer <token>` header injection
- a 10 MB response body limit
- URL validation in `handleNavigate` (must start with `http://` or `https://`)

## Tool Categories

| Category | Count | REST Endpoints Used |
|----------|-------|---------------------|
| Navigation | 4 | `/navigate`, `/snapshot`, `/screenshot`, `/text` |
| Interaction | 8 | `/action` (with `action` field) |
| Content | 3 | `/evaluate`, `/pdf`, `/find` |
| Tab Management | 4 | `/tabs`, `/health`, `/cookies` |
| Utility | 2 | `/evaluate` (wait-for-selector), local sleep |

## Security Considerations

- **`pinchtab_eval`** calls `/evaluate`, which requires `security.allowEvaluate: true` in the PinchTab config. It returns HTTP 403 by default. This is intentional — arbitrary JS execution is a separate opt-in from browser control.
- **URL validation** — `pinchtab_navigate` rejects non-HTTP/HTTPS URLs to prevent SSRF via `file://`, `javascript:`, or custom schemes.
- **Token forwarding** — the MCP client forwards the configured bearer token to PinchTab, so access control at the PinchTab layer applies to all tool calls.
- **Wait caps** — `pinchtab_wait` and `pinchtab_wait_for_selector` enforce a 30-second maximum to prevent agent runaway.

## Related Pages

- [MCP User Guide](../mcp.md)
- [Architecture Overview](./index.md)
- [MCP Tool Reference](../reference/mcp-tools.md)
- [Security Guide](../guides/security.md)
