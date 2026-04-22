package container

import (
	"context"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
	"github.com/rs/zerolog/log"
)

const (
	restartLoopThreshold = 3
	restartLoopWindow    = 5 * time.Minute
)

// CrashEvent is emitted when a container crashes or enters a restart loop.
type CrashEvent struct {
	ContainerID   string `json:"container_id"`
	ContainerName string `json:"container_name"`
	EventType     string `json:"event_type"` // "crash" or "restart_loop"
	ExitCode      int    `json:"exit_code"`
	RestartCount  int    `json:"restart_count"`
}

type crashWatcher struct {
	mu          sync.Mutex
	deathHist   map[string][]time.Time
	alertedDead map[string]bool
}

// WatchCrashEvents subscribes to Docker container events and calls onEvent for each
// detected crash or restart loop. Reconnects automatically on stream errors.
// Blocks until ctx is cancelled — run in its own goroutine.
func WatchCrashEvents(ctx context.Context, cli *client.Client, onEvent func(CrashEvent)) {
	w := &crashWatcher{
		deathHist:   make(map[string][]time.Time),
		alertedDead: make(map[string]bool),
	}
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		if err := w.run(ctx, cli, onEvent); err != nil {
			log.Error().Err(err).Msg("Docker event stream error, reconnecting in 10s")
			select {
			case <-ctx.Done():
				return
			case <-time.After(10 * time.Second):
			}
		}
	}
}

func (w *crashWatcher) run(ctx context.Context, cli *client.Client, onEvent func(CrashEvent)) error {
	f := filters.NewArgs(
		filters.Arg("type", "container"),
		filters.Arg("event", "die"),
		filters.Arg("event", "start"),
	)
	msgCh, errCh := cli.Events(ctx, events.ListOptions{Filters: f})
	for {
		select {
		case <-ctx.Done():
			return nil
		case err := <-errCh:
			return err
		case msg := <-msgCh:
			w.handle(msg, onEvent)
		}
	}
}

func (w *crashWatcher) handle(msg events.Message, onEvent func(CrashEvent)) {
	w.mu.Lock()
	defer w.mu.Unlock()

	id := msg.Actor.ID
	if len(id) > 12 {
		id = id[:12]
	}
	name := strings.TrimPrefix(msg.Actor.Attributes["name"], "/")

	switch msg.Action {
	case "start":
		// Container (re)started — reset so we can alert on future deaths.
		w.alertedDead[id] = false

	case "die":
		exitCode, _ := strconv.Atoi(msg.Actor.Attributes["exitCode"])
		now := time.Now()

		w.deathHist[id] = append(w.deathHist[id], now)

		// Trim entries outside the sliding window.
		cutoff := now.Add(-restartLoopWindow)
		hist := w.deathHist[id]
		i := 0
		for i < len(hist) && hist[i].Before(cutoff) {
			i++
		}
		w.deathHist[id] = hist[i:]

		if len(w.deathHist[id]) >= restartLoopThreshold {
			onEvent(CrashEvent{
				ContainerID:   id,
				ContainerName: name,
				EventType:     "restart_loop",
				ExitCode:      exitCode,
				RestartCount:  len(w.deathHist[id]),
			})
			w.deathHist[id] = nil
			w.alertedDead[id] = false
			return
		}

		if !w.alertedDead[id] {
			w.alertedDead[id] = true
			onEvent(CrashEvent{
				ContainerID:   id,
				ContainerName: name,
				EventType:     "crash",
				ExitCode:      exitCode,
			})
		}
	}
}
