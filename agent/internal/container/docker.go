package container

import (
	"context"

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

func (d *DockerClient) ListContainers(ctx context.Context) ([]collector.ContainerInfo, error) {
	containers, err := d.cli.ContainerList(ctx, containerTypes.ListOptions{All: true})
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

// ContainerManager interface
type ContainerManager interface {
	ListContainers(ctx context.Context) ([]collector.ContainerInfo, error)
	ContainerAction(ctx context.Context, containerID string, action string) error
}

var _ ContainerManager = (*DockerClient)(nil)
var _ ContainerManager = (*StubDockerClient)(nil)

// ignore unused
var _ = types.ContainerJSON{}
