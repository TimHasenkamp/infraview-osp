package collector

import (
	"io"
	"net/http"
	"strings"
	"time"
)

// fetchPublicIP tries to get the public IP from a lightweight plaintext endpoint.
// Returns an empty string if the request fails or times out.
func fetchPublicIP() string {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("https://api.ipify.org")
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(body))
}
