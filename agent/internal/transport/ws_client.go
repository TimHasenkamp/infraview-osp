package transport

import (
	"context"
	"encoding/json"
	"math"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"

	"github.com/infraview/agent/internal/collector"
)

const (
	pingInterval  = 15 * time.Second
	readTimeout   = 30 * time.Second
	writeTimeout  = 10 * time.Second
)

type WSClient struct {
	url              string
	conn             *websocket.Conn
	mu               sync.Mutex
	onCommand        func(containerID, action, targetImage string)
	onLogs           func(containerID, requestID string, lines int)
	onComposePreview func(containerID, targetImage, requestID string)
	onRefreshUpdates func()
	onRefreshImages  func()
	onSelfUpdate     func()
	onListImages     func(requestID string)
	onRemoveImages   func(imageIDs []string, requestID string)
	connected        bool
	stopPing         chan struct{}
}

type wsMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type containerCommand struct {
	ContainerID string `json:"container_id"`
	Action      string `json:"action"`
	TargetImage string `json:"target_image,omitempty"`
}

type containerLogsRequest struct {
	ContainerID string `json:"container_id"`
	RequestID   string `json:"request_id"`
	Lines       int    `json:"lines"`
}

func NewWSClient(url string, onCommand func(containerID, action, targetImage string), onLogs func(containerID, requestID string, lines int), onComposePreview ...func(containerID, targetImage, requestID string)) *WSClient {
	c := &WSClient{
		url:       url,
		onCommand: onCommand,
		onLogs:    onLogs,
	}
	if len(onComposePreview) > 0 {
		c.onComposePreview = onComposePreview[0]
	}
	return c
}

func (w *WSClient) Connect(ctx context.Context) error {
	attempt := 0
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		conn, _, err := websocket.DefaultDialer.DialContext(ctx, w.url, nil)
		if err != nil {
			delay := backoff(attempt)
			log.Warn().Err(err).Int("attempt", attempt+1).Dur("retry_in", delay).Msg("Connection failed")
			attempt++
			time.Sleep(delay)
			continue
		}

		w.mu.Lock()
		// Stop previous ping loop if any
		if w.stopPing != nil {
			close(w.stopPing)
		}
		w.conn = conn
		w.connected = true
		w.stopPing = make(chan struct{})
		stopCh := w.stopPing

		// Pong handler resets read deadline
		conn.SetPongHandler(func(string) error {
			return conn.SetReadDeadline(time.Now().Add(readTimeout))
		})
		// Set initial read deadline
		conn.SetReadDeadline(time.Now().Add(readTimeout))

		w.mu.Unlock()

		// Start ping loop
		go w.pingLoop(conn, stopCh)

		log.Info().Str("url", w.url).Msg("Connected")
		attempt = 0
		return nil
	}
}

func (w *WSClient) pingLoop(conn *websocket.Conn, stop chan struct{}) {
	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			w.mu.Lock()
			if w.conn != conn {
				w.mu.Unlock()
				return
			}
			conn.SetWriteDeadline(time.Now().Add(writeTimeout))
			err := conn.WriteMessage(websocket.PingMessage, nil)
			w.mu.Unlock()

			if err != nil {
				log.Warn().Err(err).Msg("Ping failed")
				return
			}
		}
	}
}

func (w *WSClient) SendSnapshot(snapshot *collector.SystemSnapshot) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.conn == nil {
		return nil
	}

	payload, err := json.Marshal(snapshot)
	if err != nil {
		return err
	}

	w.conn.SetWriteDeadline(time.Now().Add(writeTimeout))
	return w.conn.WriteJSON(wsMessage{
		Type:    "snapshot",
		Payload: payload,
	})
}

func (w *WSClient) ListenForCommands(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		w.mu.Lock()
		conn := w.conn
		w.mu.Unlock()

		if conn == nil {
			time.Sleep(time.Second)
			continue
		}

		// Read deadline is managed by pong handler
		conn.SetReadDeadline(time.Now().Add(readTimeout))
		_, rawMsg, err := conn.ReadMessage()
		if err != nil {
			log.Warn().Err(err).Msg("Read error")
			w.mu.Lock()
			w.connected = false
			if w.stopPing != nil {
				close(w.stopPing)
				w.stopPing = nil
			}
			w.conn = nil
			w.mu.Unlock()

			if err := w.Connect(ctx); err != nil {
				return
			}
			continue
		}

		var msg wsMessage
		if err := json.Unmarshal(rawMsg, &msg); err != nil {
			log.Debug().Err(err).Msg("Invalid message JSON")
			continue
		}

		switch msg.Type {
		case "container_command":
			if w.onCommand != nil {
				var cmd containerCommand
				if err := json.Unmarshal(msg.Payload, &cmd); err == nil {
					w.onCommand(cmd.ContainerID, cmd.Action, cmd.TargetImage)
				}
			}
		case "container_logs_request":
			if w.onLogs != nil {
				var req containerLogsRequest
				if err := json.Unmarshal(msg.Payload, &req); err == nil {
					w.onLogs(req.ContainerID, req.RequestID, req.Lines)
				}
			}
		case "compose_preview_request":
			if w.onComposePreview != nil {
				var req struct {
					ContainerID string `json:"container_id"`
					TargetImage string `json:"target_image"`
					RequestID   string `json:"request_id"`
				}
				if err := json.Unmarshal(msg.Payload, &req); err == nil {
					w.onComposePreview(req.ContainerID, req.TargetImage, req.RequestID)
				}
			}
		case "refresh_updates":
			if w.onRefreshUpdates != nil {
				w.onRefreshUpdates()
			}
		case "refresh_images":
			if w.onRefreshImages != nil {
				w.onRefreshImages()
			}
		case "self_update":
			if w.onSelfUpdate != nil {
				go w.onSelfUpdate()
			}
		case "list_images_request":
			if w.onListImages != nil {
				var req struct {
					RequestID string `json:"request_id"`
				}
				if err := json.Unmarshal(msg.Payload, &req); err == nil {
					go w.onListImages(req.RequestID)
				}
			}
		case "remove_images_request":
			if w.onRemoveImages != nil {
				var req struct {
					RequestID string   `json:"request_id"`
					ImageIDs  []string `json:"image_ids"`
				}
				if err := json.Unmarshal(msg.Payload, &req); err == nil {
					go w.onRemoveImages(req.ImageIDs, req.RequestID)
				}
			}
		}
	}
}

func (w *WSClient) SendLogsResponse(requestID string, logs string, errMsg string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.conn == nil {
		return nil
	}

	payload, _ := json.Marshal(map[string]string{
		"request_id": requestID,
		"logs":       logs,
		"error":      errMsg,
	})

	w.conn.SetWriteDeadline(time.Now().Add(writeTimeout))
	return w.conn.WriteJSON(wsMessage{
		Type:    "container_logs_response",
		Payload: payload,
	})
}

func (w *WSClient) SendJSON(msg map[string]any) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.conn == nil {
		return nil
	}
	w.conn.SetWriteDeadline(time.Now().Add(writeTimeout))
	return w.conn.WriteJSON(msg)
}

func (w *WSClient) SetOnRefreshUpdates(fn func()) {
	w.onRefreshUpdates = fn
}

func (w *WSClient) SetOnRefreshImages(fn func()) {
	w.onRefreshImages = fn
}

func (w *WSClient) SetOnSelfUpdate(fn func()) {
	w.onSelfUpdate = fn
}

func (w *WSClient) SetOnListImages(fn func(requestID string)) {
	w.onListImages = fn
}

func (w *WSClient) SetOnRemoveImages(fn func(imageIDs []string, requestID string)) {
	w.onRemoveImages = fn
}

func (w *WSClient) IsConnected() bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.connected
}

func (w *WSClient) Close() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.stopPing != nil {
		close(w.stopPing)
		w.stopPing = nil
	}
	if w.conn != nil {
		w.conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		w.conn.Close()
		w.conn = nil
		w.connected = false
	}
}

func backoff(attempt int) time.Duration {
	base := float64(time.Second)
	max := float64(30 * time.Second)
	delay := base * math.Pow(2, float64(attempt))
	if delay > max {
		delay = max
	}
	return time.Duration(delay)
}
