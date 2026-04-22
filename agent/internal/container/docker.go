package container

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"

	"github.com/docker/docker/api/types"
	containerTypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/infraview/agent/internal/collector"
	"github.com/rs/zerolog/log"
)

type DockerClient struct {
	cli *client.Client
}

func NewDockerClient() (*DockerClient, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	return &DockerClient{cli: cli}, nil
}

func (d *DockerClient) RawClient() *client.Client {
	return d.cli
}

// containerStatsJSON is the subset of Docker's stats response we need.
type containerStatsJSON struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs     int    `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64 `json:"usage"`
		Limit uint64 `json:"limit"`
		Stats struct {
			Cache uint64 `json:"cache"`
		} `json:"stats"`
	} `json:"memory_stats"`
}

func (d *DockerClient) fetchContainerStats(ctx context.Context, containerID string) (cpuPercent float64, memBytes, memLimit uint64) {
	resp, err := d.cli.ContainerStats(ctx, containerID, false)
	if err != nil {
		return 0, 0, 0
	}
	defer resp.Body.Close()

	var s containerStatsJSON
	if err := json.NewDecoder(resp.Body).Decode(&s); err != nil {
		return 0, 0, 0
	}

	cpuDelta := float64(s.CPUStats.CPUUsage.TotalUsage - s.PreCPUStats.CPUUsage.TotalUsage)
	sysDelta := float64(s.CPUStats.SystemCPUUsage - s.PreCPUStats.SystemCPUUsage)
	cpus := s.CPUStats.OnlineCPUs
	if cpus == 0 {
		cpus = 1
	}
	if sysDelta > 0 {
		cpuPercent = (cpuDelta / sysDelta) * float64(cpus) * 100.0
	}

	// Subtract page cache for a more accurate "used" number.
	cache := s.MemoryStats.Stats.Cache
	if s.MemoryStats.Usage > cache {
		memBytes = s.MemoryStats.Usage - cache
	}
	memLimit = s.MemoryStats.Limit
	return cpuPercent, memBytes, memLimit
}

func (d *DockerClient) ListContainers(ctx context.Context) ([]collector.ContainerInfo, error) {
	containers, err := d.cli.ContainerList(ctx, containerTypes.ListOptions{All: false})
	if err != nil {
		return nil, err
	}

	result := make([]collector.ContainerInfo, 0, len(containers))
	for _, c := range containers {
		name := ""
		if len(c.Names) > 0 {
			name = c.Names[0]
			if len(name) > 0 && name[0] == '/' {
				name = name[1:]
			}
		}

		cpuPct, memBytes, memLimit := d.fetchContainerStats(ctx, c.ID)

		result = append(result, collector.ContainerInfo{
			ID:          c.ID[:12],
			Name:        name,
			Image:       c.Image,
			State:       c.State,
			Status:      c.Status,
			Created:     c.Created,
			CPUPercent:  cpuPct,
			MemoryBytes: memBytes,
			MemoryLimit: memLimit,
		})
	}

	return result, nil
}

func (d *DockerClient) ContainerAction(ctx context.Context, containerID string, action string) error {
	switch action {
	case "start":
		return d.cli.ContainerStart(ctx, containerID, containerTypes.StartOptions{})
	case "stop":
		return d.cli.ContainerStop(ctx, containerID, containerTypes.StopOptions{})
	case "restart":
		return d.cli.ContainerRestart(ctx, containerID, containerTypes.StopOptions{})
	case "update":
		return d.UpdateContainer(ctx, containerID, "", false)
	default:
		return nil
	}
}

func (d *DockerClient) UpdateContainer(ctx context.Context, containerID string, targetImage string, updateCompose bool) error {
	// 1. Inspect current container to get its full config
	inspect, err := d.cli.ContainerInspect(ctx, containerID)
	if err != nil {
		return fmt.Errorf("inspect failed: %w", err)
	}

	imageName := inspect.Config.Image
	if targetImage != "" {
		// Replace tag: e.g. "nginx:1.24" + target "1.29.6" → "nginx:1.29.6"
		if idx := len(imageName) - 1; idx >= 0 {
			for i := idx; i >= 0; i-- {
				if imageName[i] == ':' {
					imageName = imageName[:i+1] + targetImage
					break
				}
			}
		}
	}
	oldName := inspect.Name
	if len(oldName) > 0 && oldName[0] == '/' {
		oldName = oldName[1:]
	}

	log.Info().Str("container", oldName).Str("image", imageName).Msg("Pulling latest image")

	// 2. Pull latest image
	reader, err := d.cli.ImagePull(ctx, imageName, image.PullOptions{})
	if err != nil {
		return fmt.Errorf("image pull failed: %w", err)
	}
	// Must read to completion for pull to finish
	io.Copy(io.Discard, reader)
	reader.Close()

	log.Info().Str("container", oldName).Msg("Stopping old container")

	// 3. Stop old container
	if inspect.State.Running {
		if err := d.cli.ContainerStop(ctx, containerID, containerTypes.StopOptions{}); err != nil {
			return fmt.Errorf("stop failed: %w", err)
		}
	}

	// 4. Rename old container so we can reuse the name
	tempName := oldName + "_old_" + containerID[:8]
	if err := d.cli.ContainerRename(ctx, containerID, tempName); err != nil {
		return fmt.Errorf("rename failed: %w", err)
	}

	log.Info().Str("container", oldName).Msg("Creating new container")

	// 5. Create new container with same config but updated image
	config := inspect.Config
	config.Image = imageName
	newContainer, err := d.cli.ContainerCreate(ctx,
		config,
		inspect.HostConfig,
		&network.NetworkingConfig{
			EndpointsConfig: inspect.NetworkSettings.Networks,
		},
		nil,
		oldName,
	)
	if err != nil {
		// Rollback: rename old container back
		d.cli.ContainerRename(ctx, tempName, oldName)
		d.cli.ContainerStart(ctx, containerID, containerTypes.StartOptions{})
		return fmt.Errorf("create failed: %w", err)
	}

	// 6. Start new container
	if err := d.cli.ContainerStart(ctx, newContainer.ID, containerTypes.StartOptions{}); err != nil {
		// Rollback
		d.cli.ContainerRemove(ctx, newContainer.ID, containerTypes.RemoveOptions{})
		d.cli.ContainerRename(ctx, tempName, oldName)
		d.cli.ContainerStart(ctx, containerID, containerTypes.StartOptions{})
		return fmt.Errorf("start failed: %w", err)
	}

	// 7. Remove old container
	d.cli.ContainerRemove(ctx, tempName, containerTypes.RemoveOptions{})

	// 8. Update docker-compose file if requested and available
	composeFile := resolveComposePath(inspect.Config.Labels)
	serviceName := inspect.Config.Labels["com.docker.compose.service"]
	if updateCompose && composeFile != "" && serviceName != "" {
		oldImage := inspect.Config.Image
		if err := patchComposeImage(composeFile, serviceName, oldImage, imageName); err != nil {
			log.Warn().Err(err).Str("file", composeFile).Msg("Failed to update compose file (container was updated)")
		} else {
			log.Info().Str("file", composeFile).Str("service", serviceName).Str("image", imageName).Msg("Compose file updated")
		}
	}

	log.Info().Str("container", oldName).Str("image", imageName).Msg("Container updated successfully")
	return nil
}

func (d *DockerClient) GetContainerLogs(ctx context.Context, containerID string, lines int) (string, error) {
	tail := "100"
	if lines > 0 {
		tail = fmt.Sprintf("%d", lines)
	}
	reader, err := d.cli.ContainerLogs(ctx, containerID, containerTypes.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       tail,
		Timestamps: true,
	})
	if err != nil {
		return "", err
	}
	defer reader.Close()

	out, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	// Strip Docker log header bytes (8-byte prefix per line)
	return stripDockerLogHeaders(out), nil
}

func stripDockerLogHeaders(raw []byte) string {
	var lines []byte
	for len(raw) > 0 {
		if len(raw) < 8 {
			lines = append(lines, raw...)
			break
		}
		size := int(raw[4])<<24 | int(raw[5])<<16 | int(raw[6])<<8 | int(raw[7])
		raw = raw[8:]
		if size > len(raw) {
			size = len(raw)
		}
		lines = append(lines, raw[:size]...)
		raw = raw[size:]
	}
	return string(lines)
}

func (d *DockerClient) Close() error {
	return d.cli.Close()
}

// Stub for when Docker is not available
type StubDockerClient struct{}

func NewStubClient() *StubDockerClient {
	return &StubDockerClient{}
}

func (s *StubDockerClient) ListContainers(_ context.Context) ([]collector.ContainerInfo, error) {
	return []collector.ContainerInfo{}, nil
}

func (s *StubDockerClient) ContainerAction(_ context.Context, _ string, _ string) error {
	return nil
}

func (s *StubDockerClient) UpdateContainer(_ context.Context, _ string, _ string, _ bool) error {
	return nil
}

func (s *StubDockerClient) GetComposePreview(_ context.Context, _ string, _ string) ComposePreview {
	return ComposePreview{Error: "docker not available"}
}

func (s *StubDockerClient) GetContainerLogs(_ context.Context, _ string, _ int) (string, error) {
	return "", nil
}

func (s *StubDockerClient) ListImages(_ context.Context) ([]ImageInfo, error) {
	return []ImageInfo{}, nil
}

func (s *StubDockerClient) RemoveImages(_ context.Context, _ []string) []ImageRemoveResult {
	return []ImageRemoveResult{}
}

// ImageInfo describes a local Docker image.
type ImageInfo struct {
	ID        string   `json:"id"`
	Tags      []string `json:"tags"`
	SizeBytes int64    `json:"size_bytes"`
	Created   int64    `json:"created"`
	InUse     bool     `json:"in_use"`
}

// ImageRemoveResult reports the outcome for a single image deletion attempt.
type ImageRemoveResult struct {
	ID    string `json:"id"`
	Error string `json:"error,omitempty"`
}

// ListImages returns all local images with an InUse flag.
func (d *DockerClient) ListImages(ctx context.Context) ([]ImageInfo, error) {
	imgs, err := d.cli.ImageList(ctx, image.ListOptions{All: false})
	if err != nil {
		return nil, err
	}

	// Build set of images referenced by any container (all states).
	containers, _ := d.cli.ContainerList(ctx, containerTypes.ListOptions{All: true})
	inUse := make(map[string]bool)
	for _, c := range containers {
		inUse[c.ImageID] = true
		inUse[c.Image] = true
	}

	result := make([]ImageInfo, 0, len(imgs))
	for _, img := range imgs {
		used := inUse[img.ID]
		if !used {
			for _, tag := range img.RepoTags {
				if inUse[tag] {
					used = true
					break
				}
			}
		}
		tags := img.RepoTags
		if len(tags) == 0 {
			tags = []string{"<none>:<none>"}
		}
		result = append(result, ImageInfo{
			ID:        img.ID,
			Tags:      tags,
			SizeBytes: img.Size,
			Created:   img.Created,
			InUse:     used,
		})
	}
	return result, nil
}

// RemoveImages removes a list of images by ID and returns per-image results.
func (d *DockerClient) RemoveImages(ctx context.Context, imageIDs []string) []ImageRemoveResult {
	results := make([]ImageRemoveResult, 0, len(imageIDs))
	for _, id := range imageIDs {
		_, err := d.cli.ImageRemove(ctx, id, image.RemoveOptions{Force: false, PruneChildren: true})
		r := ImageRemoveResult{ID: id}
		if err != nil {
			r.Error = err.Error()
		}
		results = append(results, r)
	}
	return results
}

// ContainerManager interface
type ContainerManager interface {
	ListContainers(ctx context.Context) ([]collector.ContainerInfo, error)
	ContainerAction(ctx context.Context, containerID string, action string) error
	UpdateContainer(ctx context.Context, containerID string, targetImage string, updateCompose bool) error
	GetComposePreview(ctx context.Context, containerID string, targetImage string) ComposePreview
	GetContainerLogs(ctx context.Context, containerID string, lines int) (string, error)
	ListImages(ctx context.Context) ([]ImageInfo, error)
	RemoveImages(ctx context.Context, imageIDs []string) []ImageRemoveResult
}

var _ ContainerManager = (*DockerClient)(nil)
var _ ContainerManager = (*StubDockerClient)(nil)

// ignore unused
var _ = types.ContainerJSON{}

// resolveComposePath maps the host compose file path to the container-accessible path.
// When running inside Docker, the host path doesn't exist — we use COMPOSE_PROJECT_DIR
// env var + the project.working_dir label to remap.
func resolveComposePath(labels map[string]string) string {
	hostPath := labels["com.docker.compose.project.config_files"]
	if hostPath == "" {
		return ""
	}

	// If file exists at the host path (running natively), use it directly
	if _, err := os.Stat(hostPath); err == nil {
		return hostPath
	}

	// Running in container — remap host path to mounted path
	mountDir := os.Getenv("COMPOSE_PROJECT_DIR")
	hostWorkDir := labels["com.docker.compose.project.working_dir"]
	if mountDir == "" || hostWorkDir == "" {
		return hostPath
	}

	// hostPath: /home/user/project/docker-compose.dev.yml
	// hostWorkDir: /home/user/project
	// mountDir: /host/compose
	// result: /host/compose/docker-compose.dev.yml
	if strings.HasPrefix(hostPath, hostWorkDir) {
		return mountDir + hostPath[len(hostWorkDir):]
	}

	return hostPath
}

// ComposePreview holds the preview data for a compose file update.
type ComposePreview struct {
	ComposeFile string `json:"compose_file"`
	Service     string `json:"service"`
	Current     string `json:"current"`
	Proposed    string `json:"proposed"`
	Error       string `json:"error"`
}

// GetComposePreview returns the current compose file content and the proposed version with updated image.
func (d *DockerClient) GetComposePreview(ctx context.Context, containerID string, targetImage string) ComposePreview {
	inspect, err := d.cli.ContainerInspect(ctx, containerID)
	if err != nil {
		return ComposePreview{Error: fmt.Sprintf("inspect failed: %v", err)}
	}

	composeFile := resolveComposePath(inspect.Config.Labels)
	serviceName := inspect.Config.Labels["com.docker.compose.service"]
	if composeFile == "" || serviceName == "" {
		return ComposePreview{Error: "container is not managed by docker compose"}
	}

	oldImage := inspect.Config.Image
	newImage := oldImage
	if targetImage != "" {
		for i := len(newImage) - 1; i >= 0; i-- {
			if newImage[i] == ':' {
				newImage = newImage[:i+1] + targetImage
				break
			}
		}
	}

	content, err := os.ReadFile(composeFile)
	if err != nil {
		return ComposePreview{Error: fmt.Sprintf("read compose file: %v", err)}
	}

	current := string(content)
	proposed := generateProposedCompose(current, serviceName, oldImage, newImage)

	return ComposePreview{
		ComposeFile: composeFile,
		Service:     serviceName,
		Current:     current,
		Proposed:    proposed,
	}
}

func generateProposedCompose(content, serviceName, oldImage, newImage string) string {
	lines := strings.Split(content, "\n")
	servicePattern := regexp.MustCompile(`^\s{2}` + regexp.QuoteMeta(serviceName) + `:`)
	imagePattern := regexp.MustCompile(`^(\s+image:\s*)(.+)$`)

	inService := false
	var result []string

	for _, line := range lines {
		if servicePattern.MatchString(line) {
			inService = true
			result = append(result, line)
			continue
		}
		if inService && len(line) > 0 && line[0] != ' ' && line[0] != '#' {
			inService = false
		}
		trimmed := strings.TrimRight(line, " \t")
		if inService && len(trimmed) > 0 && trimmed[len(trimmed)-1] == ':' {
			if match := regexp.MustCompile(`^\s{2}\S`); match.MatchString(line) {
				inService = false
			}
		}
		if inService {
			if m := imagePattern.FindStringSubmatch(line); m != nil {
				result = append(result, m[1]+newImage)
				continue
			}
		}
		result = append(result, line)
	}

	return strings.Join(result, "\n")
}

// patchComposeImage updates the image tag for a service in a docker-compose file.
// e.g. "image: nginx:1.24" → "image: nginx:1.29.6"
func patchComposeImage(filePath, serviceName, oldImage, newImage string) error {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("read compose file: %w", err)
	}

	lines := strings.Split(string(data), "\n")
	// Find the service section and its image line
	servicePattern := regexp.MustCompile(`^\s{2}` + regexp.QuoteMeta(serviceName) + `:`)
	imagePattern := regexp.MustCompile(`^(\s+image:\s*)(.+)$`)

	inService := false
	modified := false
	var result []string

	for _, line := range lines {
		if servicePattern.MatchString(line) {
			inService = true
			result = append(result, line)
			continue
		}

		// Detect leaving the service block (next top-level or service-level key)
		if inService && len(line) > 0 && line[0] != ' ' && line[0] != '#' {
			inService = false
		}
		// Another service at same indent level (2 spaces)
		trimmed := strings.TrimRight(line, " \t")
		if inService && len(trimmed) > 0 && trimmed[len(trimmed)-1] == ':' {
			match := regexp.MustCompile(`^\s{2}\S`)
			if match.MatchString(line) {
				inService = false
			}
		}

		if inService {
			if m := imagePattern.FindStringSubmatch(line); m != nil {
				result = append(result, m[1]+newImage)
				modified = true
				continue
			}
		}

		result = append(result, line)
	}

	if !modified {
		return fmt.Errorf("image line not found for service %s", serviceName)
	}

	// Write atomically
	tmpPath := filePath + ".tmp"
	if err := os.WriteFile(tmpPath, []byte(strings.Join(result, "\n")), 0644); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}
	return os.Rename(tmpPath, filePath)
}

