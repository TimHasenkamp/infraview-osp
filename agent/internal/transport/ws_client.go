package transport

import (
	"context"
	"encoding/json"
	"log"
	"math"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/infraview/agent/internal/collector"
)

type WSClient struct {
	url        string
	conn       *websocket.Conn
	mu         sync.Mutex
	onCommand  func(containerID, action string)
	connected  bool
}

type wsMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type containerCommand struct {
	ContainerID string `json:"container_id"`
	Action      string `json:"action"`
}

func NewWSClient(url string, onCommand func(containerID, action string)) *WSClient {
	return &WSClient{
		url:       url,
		onCommand: onCommand,
	}
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
			log.Printf("Connection failed (attempt %d): %v. Retrying in %v", attempt+1, err, delay)
			attempt++
			time.Sleep(delay)
			continue
		}

		w.mu.Lock()
		w.conn = conn
		w.connected = true
		w.mu.Unlock()
		log.Printf("Connected to %s", w.url)
		attempt = 0
		return nil
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

	msg := wsMessage{
		Type:    "snapshot",
		Payload: payload,
	}

	return w.conn.WriteJSON(msg)
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

		_, rawMsg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Read error: %v", err)
			w.mu.Lock()
			w.connected = false
			w.conn = nil
			w.mu.Unlock()

			// Reconnect
			if err := w.Connect(ctx); err != nil {
				return
			}
			continue
		}

		var msg wsMessage
		if err := json.Unmarshal(rawMsg, &msg); err != nil {
			continue
		}

		if msg.Type == "container_command" && w.onCommand != nil {
			var cmd containerCommand
			if err := json.Unmarshal(msg.Payload, &cmd); err == nil {
				w.onCommand(cmd.ContainerID, cmd.Action)
			}
		}
	}
}

func (w *WSClient) IsConnected() bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.connected
}

func (w *WSClient) Close() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.conn != nil {
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
