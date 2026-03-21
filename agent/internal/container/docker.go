package container

import (
	"context"
	"fmt"
	"io"

	"github.com/docker/docker/api/types"
	containerTypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/infraview/agent/internal/collector"
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

		result = append(result, collector.ContainerInfo{
			ID:      c.ID[:12],
			Name:    name,
			Image:   c.Image,
			State:   c.State,
			Status:  c.Status,
			Created: c.Created,
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
	default:
		return nil
	}
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

func (s *StubDockerClient) GetContainerLogs(_ context.Context, _ string, _ int) (string, error) {
	return "", nil
}

// ContainerManager interface
type ContainerManager interface {
	ListContainers(ctx context.Context) ([]collector.ContainerInfo, error)
	ContainerAction(ctx context.Context, containerID string, action string) error
	GetContainerLogs(ctx context.Context, containerID string, lines int) (string, error)
}

var _ ContainerManager = (*DockerClient)(nil)
var _ ContainerManager = (*StubDockerClient)(nil)

// ignore unused
var _ = types.ContainerJSON{}
