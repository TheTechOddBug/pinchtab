package actions

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/pinchtab/pinchtab/internal/cli/apiclient"
	"github.com/spf13/cobra"
)

// CacheClear clears the browser's HTTP disk cache.
func CacheClear(client *http.Client, base, token string, cmd *cobra.Command) {
	// DoPost already prints the JSON response
	result := apiclient.DoPost(client, base, token, "/cache/clear", nil)
	if result == nil {
		fmt.Fprintln(os.Stderr, "Failed to clear cache")
		os.Exit(1)
	}
}

// CacheStatus checks if the browser cache can be cleared.
func CacheStatus(client *http.Client, base, token string, cmd *cobra.Command) {
	result := apiclient.DoGetRaw(client, base, token, "/cache/status", nil)
	if result == nil {
		fmt.Fprintln(os.Stderr, "Failed to get cache status")
		os.Exit(1)
	}

	var buf map[string]any
	if err := json.Unmarshal(result, &buf); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
		os.Exit(1)
	}

	out, _ := json.MarshalIndent(buf, "", "  ")
	fmt.Println(string(out))
}
