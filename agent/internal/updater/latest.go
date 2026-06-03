package updater

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const latestAPIURL = "https://api.github.com/repos/timhasenkamp/infraview-osp/releases/latest"

var (
	latestMu      sync.Mutex
	latestTag     string
	lastAttempt   time.Time
)

// UpdateAvailable reports whether a newer release than `current` exists.
// Returns false for dev builds, on fetch failure, or when already up to date.
// The latest tag is cached (6h on success, retried every 30 min on failure) so
// this is cheap to call on every snapshot.
func UpdateAvailable(ctx context.Context, current string) bool {
	if current == "" || current == "dev" {
		return false
	}
	latest := latestVersion(ctx)
	if latest == "" {
		return false
	}
	return compareVersions(latest, current) > 0
}

func latestVersion(ctx context.Context) string {
	latestMu.Lock()
	interval := 6 * time.Hour
	if latestTag == "" {
		interval = 30 * time.Minute
	}
	if !lastAttempt.IsZero() && time.Since(lastAttempt) < interval {
		tag := latestTag
		latestMu.Unlock()
		return tag
	}
	lastAttempt = time.Now()
	have := latestTag
	latestMu.Unlock()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, latestAPIURL, nil)
	if err != nil {
		return have
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return have
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return have
	}
	var body struct {
		TagName string `json:"tag_name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return have
	}
	tag := strings.TrimSpace(body.TagName)
	if tag == "" {
		return have
	}
	latestMu.Lock()
	latestTag = tag
	latestMu.Unlock()
	return tag
}

// compareVersions returns >0 if a is newer than b, <0 if older, 0 if equal.
// Both are expected like "v1.2.3" (pre-release/build suffixes are ignored).
func compareVersions(a, b string) int {
	pa, pb := parseVersion(a), parseVersion(b)
	for i := 0; i < 3; i++ {
		if pa[i] != pb[i] {
			if pa[i] > pb[i] {
				return 1
			}
			return -1
		}
	}
	return 0
}

func parseVersion(v string) [3]int {
	v = strings.TrimPrefix(strings.TrimSpace(v), "v")
	if i := strings.IndexAny(v, "-+"); i >= 0 {
		v = v[:i]
	}
	var out [3]int
	for i, part := range strings.Split(v, ".") {
		if i >= 3 {
			break
		}
		out[i], _ = strconv.Atoi(part)
	}
	return out
}
