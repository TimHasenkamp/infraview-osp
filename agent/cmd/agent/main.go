package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/infraview/agent/internal/collector"
	"github.com/infraview/agent/internal/config"
	"github.com/infraview/agent/internal/container"
	"github.com/infraview/agent/internal/transport"
)

func main() {
	cfg := config.Load()
	log.Printf("InfraView Agent starting (id=%s, interval=%ds, backend=%s)", cfg.AgentID, cfg.Interval, cfg.BackendURL)

	hostname, _ := os.Hostname()
	coll := collector.New(cfg.AgentID, hostname, cfg.DiskPath)

	var docker container.ContainerManager
	dockerClient, err := container.NewDockerClient()
	if err != nil {
		log.Printf("Docker not available: %v (running without container monitoring)", err)
		docker = container.NewStubClient()
	} else {
		docker = dockerClient
		defer dockerClient.Close()
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	onCommand := func(containerID, action string) {
		log.Printf("Received command: %s container %s", action, containerID)
		if err := docker.ContainerAction(ctx, containerID, action); err != nil {
			log.Printf("Container action failed: %v", err)
		} else {
			log.Printf("Container action succeeded: %s %s", action, containerID)
		}
	}

	wsClient := transport.NewWSClient(cfg.BackendURL, onCommand)

	if err := wsClient.Connect(ctx); err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	defer wsClient.Close()

	go wsClient.ListenForCommands(ctx)

	ticker := time.NewTicker(time.Duration(cfg.Interval) * time.Second)
	defer ticker.Stop()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	log.Printf("Agent running. Collecting every %ds", cfg.Interval)

	for {
		select {
		case <-ticker.C:
			snapshot, err := coll.Collect()
			if err != nil {
				log.Printf("Collection error: %v", err)
				continue
			}

			containers, err := docker.ListContainers(ctx)
			if err != nil {
				log.Printf("Container list error: %v", err)
			} else {
				snapshot.Containers = containers
			}

			if err := wsClient.SendSnapshot(snapshot); err != nil {
				log.Printf("Send error: %v", err)
			}

		case sig := <-sigCh:
			log.Printf("Received %v, shutting down", sig)
			cancel()
			return
		}
	}
}
