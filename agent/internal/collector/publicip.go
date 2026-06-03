package collector

import (
	"io"
	"net/http"
	"strings"
	"time"
)

// publicIPEndpoints are lightweight plaintext "what's my IP" services, tried in
// order. Multiple providers so one being down/blocked doesn't disable the feature.
var publicIPEndpoints = []string{
	"https://api.ipify.org",
	"https://ifconfig.me/ip",
	"https://icanhazip.com",
}

// fetchPublicIP returns the public IP from the first endpoint that responds with
// a non-empty value, or an empty string if all fail.
func fetchPublicIP() string {
	client := &http.Client{Timeout: 5 * time.Second}
	for _, url := range publicIPEndpoints {
		resp, err := client.Get(url)
		if err != nil {
			continue
		}
		body, err := io.ReadAll(io.LimitReader(resp.Body, 64))
		resp.Body.Close()
		if err != nil {
			continue
		}
		if ip := strings.TrimSpace(string(body)); ip != "" {
			return ip
		}
	}
	return ""
}
