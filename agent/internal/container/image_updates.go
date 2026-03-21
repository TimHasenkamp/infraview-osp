package container

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/client"
	"github.com/rs/zerolog/log"
)

// ImageUpdateInfo holds update status for a container image
type ImageUpdateInfo struct {
	Image         string `json:"image"`
	CurrentTag    string `json:"current_tag"`
	LatestTag     string `json:"latest_tag"`
	UpdateAvail   bool   `json:"update_available"`
}

// ImageUpdateChecker periodically checks if container images have newer versions
type ImageUpdateChecker struct {
	cli       *client.Client
	cache     map[string]*ImageUpdateInfo
	mu        sync.RWMutex
	lastCheck time.Time
	interval  time.Duration
	httpCli   *http.Client
}

func NewImageUpdateChecker(cli *client.Client, interval time.Duration) *ImageUpdateChecker {
	return &ImageUpdateChecker{
		cli:      cli,
		cache:    make(map[string]*ImageUpdateInfo),
		interval: interval,
		httpCli: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// Check returns cached results or performs a fresh check
func (c *ImageUpdateChecker) Check(ctx context.Context, images []string) map[string]*ImageUpdateInfo {
	c.mu.RLock()
	if time.Since(c.lastCheck) < c.interval && len(c.cache) > 0 {
		result := make(map[string]*ImageUpdateInfo, len(c.cache))
		for k, v := range c.cache {
			result[k] = v
		}
		c.mu.RUnlock()
		return result
	}
	c.mu.RUnlock()

	c.mu.Lock()
	defer c.mu.Unlock()

	// Double-check after acquiring write lock
	if time.Since(c.lastCheck) < c.interval && len(c.cache) > 0 {
		result := make(map[string]*ImageUpdateInfo, len(c.cache))
		for k, v := range c.cache {
			result[k] = v
		}
		return result
	}

	log.Info().Int("image_count", len(images)).Msg("Checking container images for updates")

	// Deduplicate images
	unique := make(map[string]struct{})
	for _, img := range images {
		unique[img] = struct{}{}
	}

	newCache := make(map[string]*ImageUpdateInfo)
	for img := range unique {
		info := c.checkImage(ctx, img)
		newCache[img] = info
		if info.UpdateAvail {
			log.Info().
				Str("image", img).
				Str("current", info.CurrentTag).
				Str("latest", info.LatestTag).
				Msg("Image update available")
		}
	}

	c.cache = newCache
	c.lastCheck = time.Now()
	return newCache
}

var semverRegex = regexp.MustCompile(`^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$`)

type semver struct {
	Major int
	Minor int
	Patch int
	Raw   string
}

func parseSemver(tag string) (semver, bool) {
	m := semverRegex.FindStringSubmatch(tag)
	if m == nil {
		return semver{}, false
	}
	sv := semver{Raw: tag}
	sv.Major, _ = strconv.Atoi(m[1])
	if m[2] != "" {
		sv.Minor, _ = strconv.Atoi(m[2])
	}
	if m[3] != "" {
		sv.Patch, _ = strconv.Atoi(m[3])
	}
	return sv, true
}

func (a semver) Less(b semver) bool {
	if a.Major != b.Major {
		return a.Major < b.Major
	}
	if a.Minor != b.Minor {
		return a.Minor < b.Minor
	}
	return a.Patch < b.Patch
}

func (c *ImageUpdateChecker) checkImage(ctx context.Context, image string) *ImageUpdateInfo {
	info := &ImageUpdateInfo{
		Image:       image,
		UpdateAvail: false,
	}

	// Skip locally built images (no tag with version or no registry reference)
	registry, repo, tag := parseImageRef(image)
	info.CurrentTag = tag

	// Skip images without a versioned tag (e.g. "latest", locally built)
	currentVer, isVersioned := parseSemver(tag)
	if !isVersioned {
		return info
	}

	// Query registry for available tags
	tags, err := c.getRegistryTags(ctx, registry, repo)
	if err != nil {
		log.Debug().Err(err).Str("image", image).Msg("Failed to get registry tags")
		return info
	}

	// Find the latest semver tag in the same major version line
	var candidates []semver
	for _, t := range tags {
		sv, ok := parseSemver(t)
		if !ok {
			continue
		}
		// Same major version, newer minor/patch
		if sv.Major == currentVer.Major && currentVer.Less(sv) {
			candidates = append(candidates, sv)
		}
	}

	if len(candidates) == 0 {
		return info
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Less(candidates[j])
	})

	latest := candidates[len(candidates)-1]
	info.LatestTag = latest.Raw
	info.UpdateAvail = true

	return info
}

// parseImageRef splits an image reference into registry, repository, and tag
func parseImageRef(image string) (registry, repo, tag string) {
	registry = "registry-1.docker.io"
	tag = "latest"

	ref := image

	// Extract tag
	if atIdx := strings.LastIndex(ref, "@"); atIdx != -1 {
		ref = ref[:atIdx]
	}
	if colonIdx := strings.LastIndex(ref, ":"); colonIdx != -1 {
		possibleTag := ref[colonIdx+1:]
		if !strings.Contains(possibleTag, "/") {
			tag = possibleTag
			ref = ref[:colonIdx]
		}
	}

	// Extract registry
	parts := strings.SplitN(ref, "/", 2)
	if len(parts) == 1 {
		repo = "library/" + parts[0]
	} else if strings.Contains(parts[0], ".") || strings.Contains(parts[0], ":") || parts[0] == "localhost" {
		registry = parts[0]
		repo = parts[1]
	} else {
		repo = ref
	}

	return registry, repo, tag
}

// getRegistryTags fetches all available tags from the registry
func (c *ImageUpdateChecker) getRegistryTags(ctx context.Context, registry, repo string) ([]string, error) {
	token := ""
	if registry == "registry-1.docker.io" {
		var err error
		token, err = c.getDockerHubToken(ctx, repo)
		if err != nil {
			return nil, fmt.Errorf("auth failed: %w", err)
		}
	}

	url := fmt.Sprintf("https://%s/v2/%s/tags/list", registry, repo)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := c.httpCli.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("registry returned %d", resp.StatusCode)
	}

	var result struct {
		Tags []string `json:"tags"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Tags, nil
}

type dockerAuthResponse struct {
	Token string `json:"token"`
}

func (c *ImageUpdateChecker) getDockerHubToken(ctx context.Context, repo string) (string, error) {
	url := fmt.Sprintf("https://auth.docker.io/token?service=registry.docker.io&scope=repository:%s:pull", repo)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", err
	}

	resp, err := c.httpCli.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("auth returned %d", resp.StatusCode)
	}

	var auth dockerAuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&auth); err != nil {
		return "", err
	}

	return auth.Token, nil
}
