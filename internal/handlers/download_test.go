package handlers

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pinchtab/pinchtab/internal/bridge"
	"github.com/pinchtab/pinchtab/internal/config"
)

func TestHandleDownload_MissingURL(t *testing.T) {
	h := New(&mockBridge{}, &config.RuntimeConfig{AllowDownload: true}, nil, nil, nil)
	req := httptest.NewRequest("GET", "/download", nil)
	w := httptest.NewRecorder()
	h.HandleDownload(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandleDownload_EmptyURL(t *testing.T) {
	h := New(&mockBridge{}, &config.RuntimeConfig{AllowDownload: true}, nil, nil, nil)
	req := httptest.NewRequest("GET", "/download?url=", nil)
	w := httptest.NewRecorder()
	h.HandleDownload(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for empty URL, got %d", w.Code)
	}
}

func TestValidateDownloadURL(t *testing.T) {
	originalResolver := resolveDownloadHostIPs
	t.Cleanup(func() {
		resolveDownloadHostIPs = originalResolver
	})
	resolveDownloadHostIPs = func(ctx context.Context, network, host string) ([]net.IP, error) {
		switch host {
		case "pinchtab.com":
			return []net.IP{net.ParseIP("93.184.216.34")}, nil
		case "localhost":
			return []net.IP{net.ParseIP("127.0.0.1")}, nil
		default:
			return nil, errors.New("not found")
		}
	}

	tests := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{"valid https", "https://pinchtab.com/file.pdf", false},
		{"valid http", "http://pinchtab.com/page", false},
		{"file scheme", "file:///etc/passwd", true},
		{"ftp scheme", "ftp://pinchtab.com/file", true},
		{"data scheme", "data:text/html,hello", true},
		{"localhost", "http://localhost:8080/secret", true},
		{"loopback ipv4", "http://127.0.0.1/secret", true},
		{"loopback ipv6", "http://[::1]/secret", true},
		{"private ipv4 literal", "http://192.168.1.10/secret", true},
		{"shared address space", "http://100.64.0.1/secret", true},
		{"benchmark network", "http://198.18.0.1/secret", true},
		{"cloud metadata", "http://169.254.169.254/latest/meta-data", true},
		{"localhost suffix", "http://foo.localhost/secret", true},
		{"empty scheme", "://pinchtab.com", true},
		{"no scheme", "pinchtab.com", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateDownloadURL(tt.url)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateDownloadURL(%q) error = %v, wantErr %v", tt.url, err, tt.wantErr)
			}
		})
	}
}

func TestHandleDownload_SSRFBlocked(t *testing.T) {
	h := New(&mockBridge{}, &config.RuntimeConfig{AllowDownload: true}, nil, nil, nil)
	urls := []string{
		"file:///etc/passwd",
		"http://localhost:8080",
		"http://127.0.0.1/admin",
		"http://192.168.1.10/admin",
		"http://100.64.0.1/admin",
		"http://198.18.0.1/admin",
		"http://169.254.169.254/latest/meta-data",
	}
	for _, u := range urls {
		req := httptest.NewRequest("GET", "/download?url="+u, nil)
		w := httptest.NewRecorder()
		h.HandleDownload(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400 for SSRF URL %q, got %d", u, w.Code)
		}
	}
}

func TestHandleTabDownload_MissingTabID(t *testing.T) {
	h := New(&mockBridge{}, &config.RuntimeConfig{AllowDownload: true}, nil, nil, nil)
	req := httptest.NewRequest("GET", "/tabs//download?url=https://pinchtab.com", nil)
	w := httptest.NewRecorder()
	h.HandleTabDownload(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleTabDownload_NoTab(t *testing.T) {
	h := New(&mockBridge{failTab: true}, &config.RuntimeConfig{AllowDownload: true}, nil, nil, nil)
	req := httptest.NewRequest("GET", "/tabs/tab_abc/download?url=https://pinchtab.com", nil)
	req.SetPathValue("id", "tab_abc")
	w := httptest.NewRecorder()
	h.HandleTabDownload(w, req)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestHandleDownload_Disabled(t *testing.T) {
	h := New(&mockBridge{}, &config.RuntimeConfig{}, nil, nil, nil)
	req := httptest.NewRequest("GET", "/download?url=https://pinchtab.com/file.txt", nil)
	w := httptest.NewRecorder()
	h.HandleDownload(w, req)
	if w.Code != 403 {
		t.Errorf("expected 403 when download disabled, got %d", w.Code)
	}
}

func TestDownloadRequestGuard_BlocksBrowserSideRequests(t *testing.T) {
	originalResolver := resolveDownloadHostIPs
	t.Cleanup(func() {
		resolveDownloadHostIPs = originalResolver
	})
	resolveDownloadHostIPs = func(ctx context.Context, network, host string) ([]net.IP, error) {
		switch host {
		case "pinchtab.com":
			return []net.IP{net.ParseIP("93.184.216.34")}, nil
		default:
			return nil, errors.New("not found")
		}
	}

	guard := newDownloadRequestGuard(newDownloadURLGuard(), -1)
	err := guard.Validate("http://127.0.0.1:1337/increment", false)
	if err == nil {
		t.Fatal("expected browser-side localhost request to be blocked")
	}
	if !strings.Contains(err.Error(), "unsafe browser request") {
		t.Fatalf("expected unsafe browser request error, got %v", err)
	}
}

func TestDownloadRequestGuard_TracksRedirectLimits(t *testing.T) {
	originalResolver := resolveDownloadHostIPs
	t.Cleanup(func() {
		resolveDownloadHostIPs = originalResolver
	})
	resolveDownloadHostIPs = func(ctx context.Context, network, host string) ([]net.IP, error) {
		switch host {
		case "pinchtab.com":
			return []net.IP{net.ParseIP("93.184.216.34")}, nil
		default:
			return nil, errors.New("not found")
		}
	}

	guard := newDownloadRequestGuard(newDownloadURLGuard(), 0)
	err := guard.Validate("https://pinchtab.com/redirected", true)
	if !errors.Is(err, bridge.ErrTooManyRedirects) {
		t.Fatalf("expected too-many-redirects error, got %v", err)
	}
}
