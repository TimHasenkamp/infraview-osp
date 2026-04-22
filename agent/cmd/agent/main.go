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
	"github.com/infraview/agent/internal/updater"
)

var version = "dev" // overridden at build time via -ldflags "-X main.version=..."

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

	forceCollect := make(chan struct{}, 1)

	wsClient = transport.NewWSClient(wsURL, onCommand, onLogs, onComposePreview)
	wsClient.SetOnRefreshUpdates(func() {
		log.Info().Msg("APT cache cleared — triggering immediate snapshot")
		collector.ClearUpdatesCache()
		select {
		case forceCollect <- struct{}{}:
		default:
		}
	})
	wsClient.SetOnRefreshImages(func() {
		log.Info().Msg("Image update cache cleared — triggering immediate snapshot")
		if imageChecker != nil {
			imageChecker.Invalidate()
		}
		select {
		case forceCollect <- struct{}{}:
		default:
		}
	})

	wsClient.SetOnListImages(func(requestID string) {
		listCtx, listCancel := context.WithTimeout(ctx, 30*time.Second)
		defer listCancel()
		images, err := docker.ListImages(listCtx)
		errMsg := ""
		if err != nil {
			errMsg = err.Error()
			log.Error().Err(err).Msg("List images failed")
		}
		_ = wsClient.SendJSON(map[string]any{
			"type": "image_list_response",
			"payload": map[string]any{
				"request_id": requestID,
				"images":     images,
				"error":      errMsg,
			},
		})
	})

	wsClient.SetOnRemoveImages(func(imageIDs []string, requestID string) {
		removeCtx, removeCancel := context.WithTimeout(ctx, 2*time.Minute)
		defer removeCancel()
		results := docker.RemoveImages(removeCtx, imageIDs)
		_ = wsClient.SendJSON(map[string]any{
			"type": "image_remove_response",
			"payload": map[string]any{
				"request_id": requestID,
				"results":    results,
			},
		})
	})

	wsClient.SetOnSelfUpdate(func() {
		sendStatus := func(status, message string) {
			log.Info().Str("status", status).Str("message", message).Msg("Self-update")
			_ = wsClient.SendJSON(map[string]any{
				"type": "self_update_response",
				"payload": map[string]any{
					"status":  status,
					"message": message,
				},
			})
		}
		if updater.IsInContainer() {
			if dockerClient != nil {
				updater.RunDocker(ctx, dockerClient.RawClient(), sendStatus)
			} else {
				sendStatus("error", "Docker client not available")
			}
		} else {
			updater.RunNative(ctx, sendStatus)
		}
	})

	// Start container crash watcher if Docker is available.
	if dockerClient != nil {
		go container.WatchCrashEvents(ctx, dockerClient.RawClient(), func(ev container.CrashEvent) {
			log.Warn().
				Str("container", ev.ContainerName).
				Str("event", ev.EventType).
				Int("exit_code", ev.ExitCode).
				Msg("Container crash event")
			_ = wsClient.SendJSON(map[string]any{
				"type": "container_crash_event",
				"payload": map[string]any{
					"agent_id":       cfg.AgentID,
					"container_id":   ev.ContainerID,
					"container_name": ev.ContainerName,
					"event_type":     ev.EventType,
					"exit_code":      ev.ExitCode,
					"restart_count":  ev.RestartCount,
				},
			})
		})
	}

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

	collect := func() {
		_, collectCancel := context.WithTimeout(ctx, collectTimeout)
		snapshot, err := coll.Collect()
		collectCancel()
		if err != nil {
			log.Error().Err(err).Msg("Collection error")
			return
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
	}

	for {
		select {
		case <-forceCollect:
			collect()
		case <-ticker.C:
			collect()

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
