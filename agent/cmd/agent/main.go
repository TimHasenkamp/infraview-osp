package main

import (
	"context"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/infraview/agent/internal/collector"
	"github.com/infraview/agent/internal/config"
	"github.com/infraview/agent/internal/container"
	"github.com/infraview/agent/internal/health"
	"github.com/infraview/agent/internal/transport"
)

const (
	collectTimeout   = 10 * time.Second
	containerTimeout = 10 * time.Second
	shutdownTimeout  = 5 * time.Second
)

func main() {
	// Structured logging with zerolog
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = zerolog.New(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "15:04:05"}).
		With().Timestamp().Caller().Logger()

	cfg := config.Load()
	log.Info().
		Str("agent_id", cfg.AgentID).
		Int("interval", cfg.Interval).
		Str("backend", cfg.BackendURL).
		Msg("InfraView Agent starting")

	hostname, _ := os.Hostname()
	coll := collector.New(cfg.AgentID, hostname, cfg.DiskPath)

	var docker container.ContainerManager
	var imageChecker *container.ImageUpdateChecker
	dockerClient, err := container.NewDockerClient()
	if err != nil {
		log.Warn().Err(err).Msg("Docker not available, running without container monitoring")
		docker = container.NewStubClient()
	} else {
		docker = dockerClient
		imageChecker = container.NewImageUpdateChecker(dockerClient.RawClient(), 30*time.Minute)
		defer dockerClient.Close()
	}

	ctx, cancel := context.WithCancel(context.Background())

	onCommand := func(containerID, action, targetImage string) {
		log.Info().Str("container", containerID).Str("action", action).Str("target", targetImage).Msg("Received container command")
		timeout := containerTimeout
		if action == "update" || action == "update_compose" {
			timeout = 5 * time.Minute
		}
		cmdCtx, cmdCancel := context.WithTimeout(ctx, timeout)
		defer cmdCancel()
		var err error
		if action == "update" && targetImage != "" {
			err = docker.UpdateContainer(cmdCtx, containerID, targetImage, false)
		} else if action == "update_compose" && targetImage != "" {
			err = docker.UpdateContainer(cmdCtx, containerID, targetImage, true)
		} else {
			err = docker.ContainerAction(cmdCtx, containerID, action)
		}
		if err != nil {
			log.Error().Err(err).Str("container", containerID).Str("action", action).Msg("Container action failed")
		} else {
			log.Info().Str("container", containerID).Str("action", action).Msg("Container action succeeded")
			if action == "update" || action == "update_compose" {
				imageChecker.Invalidate()
			}
		}
	}

	var wsClient *transport.WSClient

	onLogs := func(containerID, requestID string, lines int) {
		log.Info().Str("container", containerID).Str("request_id", requestID).Int("lines", lines).Msg("Received logs request")
		logCtx, logCancel := context.WithTimeout(ctx, collectTimeout)
		defer logCancel()
		logs, err := docker.GetContainerLogs(logCtx, containerID, lines)
		errMsg := ""
		if err != nil {
			errMsg = err.Error()
			log.Error().Err(err).Str("container", containerID).Msg("Container logs failed")
		}
		if err := wsClient.SendLogsResponse(requestID, logs, errMsg); err != nil {
			log.Error().Err(err).Msg("Send logs response failed")
		}
	}

	onComposePreview := func(containerID, targetImage, requestID string) {
		log.Info().Str("container", containerID).Str("target", targetImage).Msg("Compose preview request")
		preview := docker.GetComposePreview(ctx, containerID, targetImage)
		if err := wsClient.SendJSON(map[string]any{
			"type": "compose_preview_response",
			"payload": map[string]any{
				"request_id":   requestID,
				"compose_file": preview.ComposeFile,
				"service":      preview.Service,
				"current":      preview.Current,
				"proposed":     preview.Proposed,
				"error":        preview.Error,
			},
		}); err != nil {
			log.Error().Err(err).Msg("Send compose preview failed")
		}
	}

	// Append API key to WebSocket URL
	wsURL := cfg.BackendURL
	if cfg.APIKey != "" {
		sep := "?"
		if strings.Contains(wsURL, "?") {
			sep = "&"
		}
		wsURL += sep + "key=" + cfg.APIKey
	}

	wsClient = transport.NewWSClient(wsURL, onCommand, onLogs, onComposePreview)
	wsClient.SetOnRefreshUpdates(func() {
		log.Info().Msg("APT cache cleared — will refresh on next tick")
		collector.ClearUpdatesCache()
	})

	startTime := time.Now()
	health.StartHealthServer(":8081", cfg.AgentID, startTime, wsClient.IsConnected)

	if err := wsClient.Connect(ctx); err != nil {
		log.Fatal().Err(err).Msg("Failed to connect")
	}

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		wsClient.ListenForCommands(ctx)
	}()

	ticker := time.NewTicker(time.Duration(cfg.Interval) * time.Second)
	defer ticker.Stop()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	log.Info().Int("interval_s", cfg.Interval).Msg("Agent running")

	containerErrLogged := false

	for {
		select {
		case <-ticker.C:
			_, collectCancel := context.WithTimeout(ctx, collectTimeout)
			snapshot, err := coll.Collect()
			collectCancel()
			if err != nil {
				log.Error().Err(err).Msg("Collection error")
				continue
			}

			containerCtx, containerCancel := context.WithTimeout(ctx, containerTimeout)
			containers, err := docker.ListContainers(containerCtx)
			containerCancel()
			if err != nil {
				if !containerErrLogged {
					log.Warn().Err(err).Msg("Container list error (suppressing further)")
					containerErrLogged = true
				}
			} else {
				// Check for image updates (cached, only hits registry every 30 min)
				if imageChecker != nil && len(containers) > 0 {
					images := make([]string, len(containers))
					for i, c := range containers {
						images[i] = c.Image
					}
					updates := imageChecker.Check(ctx, images)
					for i, c := range containers {
						if info, ok := updates[c.Image]; ok {
							containers[i].UpdateAvailable = info.UpdateAvail
							containers[i].LatestVersion = info.LatestTag
						}
					}
				}
				snapshot.Containers = containers
				containerErrLogged = false
			}

			if err := wsClient.SendSnapshot(snapshot); err != nil {
				log.Error().Err(err).Msg("Send snapshot failed")
			}

		case sig := <-sigCh:
			log.Info().Str("signal", sig.String()).Msg("Shutting down gracefully")
			cancel()

			done := make(chan struct{})
			go func() {
				wg.Wait()
				close(done)
			}()

			select {
			case <-done:
				log.Info().Msg("All goroutines stopped")
			case <-time.After(shutdownTimeout):
				log.Warn().Msg("Shutdown timeout, forcing exit")
			}

			wsClient.Close()
			return
		}
	}
}
