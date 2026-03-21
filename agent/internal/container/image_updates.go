package container

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/client"
	"github.com/rs/zerolog/log"
)

// ImageUpdateInfo holds update status for a container image
type ImageUpdateInfo struct {
	Image          string `json:"image"`
	CurrentDigest  string `json:"current_digest"`
	LatestDigest   string `json:"latest_digest"`
	UpdateAvail    bool   `json:"update_available"`
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
			log.Info().Str("image", img).Msg("Image update available")
		}
	}

	c.cache = newCache
	c.lastCheck = time.Now()
	return newCache
}

func (c *ImageUpdateChecker) checkImage(ctx context.Context, image string) *ImageUpdateInfo {
	info := &ImageUpdateInfo{
		Image:       image,
		UpdateAvail: false,
	}

	// Get local image digest
	inspect, _, err := c.cli.ImageInspectWithRaw(ctx, image)
	if err != nil {
		log.Debug().Err(err).Str("image", image).Msg("Failed to inspect local image")
		return info
	}

	// Get the repo digest (the one from the registry)
	localDigest := ""
	for _, d := range inspect.RepoDigests {
		parts := strings.SplitN(d, "@", 2)
		if len(parts) == 2 {
			localDigest = parts[1]
			break
		}
	}
	info.CurrentDigest = localDigest

	if localDigest == "" {
		// Locally built image, no registry digest
		return info
	}

	// Parse image reference into registry/repo/tag
	registry, repo, tag := parseImageRef(image)

	// Get remote digest from registry
	remoteDigest, err := c.getRemoteDigest(ctx, registry, repo, tag)
	if err != nil {
		log.Debug().Err(err).Str("image", image).Msg("Failed to get remote digest")
		return info
	}

	info.LatestDigest = remoteDigest
	info.UpdateAvail = remoteDigest != "" && localDigest != "" && remoteDigest != localDigest

	return info
}

// parseImageRef splits an image reference into registry, repository, and tag
func parseImageRef(image string) (registry, repo, tag string) {
	// Default values
	registry = "registry-1.docker.io"
	tag = "latest"

	ref := image

	// Extract tag
	if atIdx := strings.LastIndex(ref, "@"); atIdx != -1 {
		// Image with digest, skip tag extraction
		ref = ref[:atIdx]
	}
	if colonIdx := strings.LastIndex(ref, ":"); colonIdx != -1 {
		possibleTag := ref[colonIdx+1:]
		// Make sure it's a tag, not a port
		if !strings.Contains(possibleTag, "/") {
			tag = possibleTag
			ref = ref[:colonIdx]
		}
	}

	// Extract registry
	parts := strings.SplitN(ref, "/", 2)
	if len(parts) == 1 {
		// Just image name, e.g. "nginx"
		repo = "library/" + parts[0]
	} else if strings.Contains(parts[0], ".") || strings.Contains(parts[0], ":") || parts[0] == "localhost" {
		// Has registry, e.g. "ghcr.io/user/repo"
		registry = parts[0]
		repo = parts[1]
	} else {
		// Docker Hub with namespace, e.g. "user/repo"
		repo = ref
	}

	return registry, repo, tag
}

// getRemoteDigest queries the registry v2 API for the manifest digest
func (c *ImageUpdateChecker) getRemoteDigest(ctx context.Context, registry, repo, tag string) (string, error) {
	// Get auth token if Docker Hub
	token := ""
	if registry == "registry-1.docker.io" {
		var err error
		token, err = c.getDockerHubToken(ctx, repo)
		if err != nil {
			return "", fmt.Errorf("auth failed: %w", err)
		}
	}

	url := fmt.Sprintf("https://%s/v2/%s/manifests/%s", registry, repo, tag)

	req, err := http.NewRequestWithContext(ctx, "HEAD", url, nil)
	if err != nil {
		return "", err
	}

	// Accept manifest list (multi-arch) and single manifest
	req.Header.Set("Accept", "application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.index.v1+json")

	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := c.httpCli.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("registry returned %d", resp.StatusCode)
	}

	digest := resp.Header.Get("Docker-Content-Digest")
	return digest, nil
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
