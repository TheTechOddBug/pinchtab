package strategy

import (
	"net/http"

	"github.com/pinchtab/pinchtab/internal/orchestrator"
)

// ShorthandRoutes are the proxy routes that every strategy registers.
// They forward to the first running instance (or the managed instance).
// Defined once here to avoid duplication across strategy implementations.
var ShorthandRoutes = []string{
	"GET /snapshot", "GET /screenshot", "GET /text", "GET /pdf", "POST /pdf",
	"GET /console", "POST /console/clear",
	"GET /errors", "POST /errors/clear",
	"GET /clipboard/read", "POST /clipboard/write", "POST /clipboard/copy", "GET /clipboard/paste",
	"GET /network", "GET /network/stream", "GET /network/export", "GET /network/export/stream", "GET /network/{requestId}", "POST /network/clear",
	"POST /navigate", "POST /back", "POST /forward", "POST /reload",
	"POST /action", "POST /actions",
	"POST /dialog",
	"POST /wait",
	"POST /tab", "POST /tab/lock", "POST /tab/unlock",
	"GET /cookies", "POST /cookies",
	"GET /stealth/status", "POST /fingerprint/rotate",
	"POST /find",
	"POST /cache/clear", "GET /cache/status",
	"GET /solvers",
	"POST /solve", "POST /solve/{name}",
}

// RegisterShorthandRoutes registers all shorthand proxy routes on the mux,
// binding them to the given handler. It also registers capability-gated
// routes (evaluate, download, upload, screencast, macro) using the
// orchestrator's security settings.
func RegisterShorthandRoutes(mux *http.ServeMux, orch *orchestrator.Orchestrator, handler http.HandlerFunc) {
	for _, route := range ShorthandRoutes {
		mux.HandleFunc(route, handler)
	}

	RegisterCapabilityRoute(mux, "POST /evaluate", orch.AllowsEvaluate(), "evaluate", "security.allowEvaluate", "evaluate_disabled", handler)
	RegisterCapabilityRoute(mux, "GET /download", orch.AllowsDownload(), "download", "security.allowDownload", "download_disabled", handler)
	RegisterCapabilityRoute(mux, "POST /upload", orch.AllowsUpload(), "upload", "security.allowUpload", "upload_disabled", handler)
	RegisterCapabilityRoute(mux, "GET /screencast", orch.AllowsScreencast(), "screencast", "security.allowScreencast", "screencast_disabled", handler)
	RegisterCapabilityRoute(mux, "GET /screencast/tabs", orch.AllowsScreencast(), "screencast", "security.allowScreencast", "screencast_disabled", handler)
	RegisterCapabilityRoute(mux, "POST /macro", orch.AllowsMacro(), "macro", "security.allowMacro", "macro_disabled", handler)
}
