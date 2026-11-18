package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"syscall"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// The download proxy behind "Download from URL" in the part dialog. The browser cannot
// fetch most vendor files itself (CORS), so the backend downloads them for a logged-in user.
//
// It only follows http(s) URLs and, unless KIDRA_DOWNLOAD_ALLOW_PRIVATE is "true", refuses
// to connect to loopback, private, link-local and other non-public addresses (checked on
// every connection after DNS resolution, so redirects and DNS tricks are covered too).

// maxDownloadSize matches the max size of the attachments `file` field.
const maxDownloadSize = 100 << 20

var errPrivateTarget = errors.New("downloads from local or private network addresses are not allowed")

// validateDownloadURL accepts absolute http(s) URLs with a host and without credentials.
func validateDownloadURL(rawURL string) (*url.URL, error) {
	parsedURL, err := url.ParseRequestURI(rawURL)
	if err != nil || parsedURL.Hostname() == "" ||
		(parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		return nil, errors.New("A valid HTTP(S) URL is required")
	}
	if parsedURL.User != nil {
		return nil, errors.New("URL credentials are not supported")
	}
	return parsedURL, nil
}

// isPublicIP reports whether ip is a globally routable unicast address.
func isPublicIP(ip net.IP) bool {
	if ip == nil {
		return false
	}
	if ip4 := ip.To4(); ip4 != nil {
		// 0.0.0.0/8 and 100.64.0.0/10 (carrier-grade NAT) are not covered by the checks below.
		if ip4[0] == 0 || (ip4[0] == 100 && ip4[1]&0xc0 == 64) {
			return false
		}
	}
	return !(ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsInterfaceLocalMulticast() || ip.IsMulticast())
}

// newDownloadClient returns the proxy's HTTP client. Without allowPrivate, every connection
// to a non-public address is refused at dial time.
func newDownloadClient(allowPrivate bool) *http.Client {
	dialer := &net.Dialer{Timeout: 15 * time.Second}
	if !allowPrivate {
		dialer.Control = func(_ string, address string, _ syscall.RawConn) error {
			host, _, err := net.SplitHostPort(address)
			if err != nil {
				return err
			}
			if !isPublicIP(net.ParseIP(host)) {
				return errPrivateTarget
			}
			return nil
		}
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DialContext = dialer.DialContext
	// An HTTP proxy from the environment would hide the real target from the address check.
	transport.Proxy = nil
	return &http.Client{
		Transport: transport,
		CheckRedirect: func(request *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return errors.New("too many redirects")
			}
			if request.URL.Scheme != "http" && request.URL.Scheme != "https" {
				return errors.New("redirect to a non-HTTP(S) URL")
			}
			return nil
		},
	}
}

func downloadTooLarge(e *core.RequestEvent) error {
	return e.String(http.StatusRequestEntityTooLarge, fmt.Sprintf("The file exceeds the %d MB limit", maxDownloadSize>>20))
}

// handleDownload proxies one download. It is bound with apis.RequireAuth().
func handleDownload(client *http.Client) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		parsedURL, err := validateDownloadURL(e.Request.URL.Query().Get("url"))
		if err != nil {
			return e.String(http.StatusBadRequest, err.Error())
		}

		ctx, cancel := context.WithTimeout(e.Request.Context(), 120*time.Second)
		defer cancel()
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, parsedURL.String(), nil)
		if err != nil {
			return e.String(http.StatusBadRequest, "Failed to create the download request")
		}
		response, err := client.Do(request)
		if err != nil {
			if errors.Is(err, errPrivateTarget) {
				return e.String(http.StatusForbidden, "Downloads from local or private network addresses are not allowed")
			}
			return e.String(http.StatusBadGateway, fmt.Sprintf("Failed to download the file: %v", err))
		}
		defer response.Body.Close()
		if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
			return e.String(http.StatusBadGateway, fmt.Sprintf("Remote server returned HTTP %d", response.StatusCode))
		}

		if response.ContentLength > maxDownloadSize {
			return downloadTooLarge(e)
		}
		body, err := io.ReadAll(io.LimitReader(response.Body, maxDownloadSize+1))
		if err != nil {
			return e.String(http.StatusBadGateway, "Failed to read the downloaded file")
		}
		if int64(len(body)) > maxDownloadSize {
			return downloadTooLarge(e)
		}
		e.Response.Header().Set("Content-Type", response.Header.Get("Content-Type"))
		e.Response.Header().Set("Cache-Control", "no-store")
		_, _ = e.Response.Write(body)
		return nil
	}
}

// RegisterCorsEndpoint registers GET /api/datasheet-download?url=…, the download proxy for
// any attachment type (the name is historic). Requires an authenticated user.
func RegisterCorsEndpoint(app *pocketbase.PocketBase) {
	allowPrivate := strings.EqualFold(envOr("KIDRA_DOWNLOAD_ALLOW_PRIVATE", "false"), "true")
	client := newDownloadClient(allowPrivate)
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/datasheet-download", handleDownload(client)).Bind(apis.RequireAuth())
		return se.Next()
	})
}
