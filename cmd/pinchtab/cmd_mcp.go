package main

import (
	"fmt"
	"os"

	"github.com/pinchtab/pinchtab/internal/config"
	"github.com/pinchtab/pinchtab/internal/mcp"
)

func runMCP(cfg *config.RuntimeConfig) {
	baseURL := os.Getenv("PINCHTAB_URL")
	if baseURL == "" {
		port := cfg.Port
		if port == "" {
			port = "9867"
		}
		baseURL = "http://127.0.0.1:" + port
	}

	token := os.Getenv("PINCHTAB_TOKEN")
	if token == "" {
		token = cfg.Token
	}

	mcp.Version = version

	if err := mcp.Serve(baseURL, token); err != nil {
		fmt.Fprintf(os.Stderr, "mcp server error: %v\n", err)
		os.Exit(1)
	}
}
