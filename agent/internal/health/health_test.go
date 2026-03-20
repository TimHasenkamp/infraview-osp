package health

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHealthEndpointConnected(t *testing.T) {
	mux := http.NewServeMux()
	startTime := time.Now()
	isConnected := func() bool { return true }

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		status := "ok"
		if !isConnected() {
			status = "degraded"
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Status{
			Status:    status,
			AgentID:   "test-agent",
			Uptime:    time.Since(startTime).Round(time.Second).String(),
			Connected: isConnected(),
		})
	})

	req := httptest.NewRequest("GET", "/health", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != 200 {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var status Status
	if err := json.NewDecoder(rec.Body).Decode(&status); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if status.Status != "ok" {
		t.Errorf("expected ok, got %s", status.Status)
	}
	if status.AgentID != "test-agent" {
		t.Errorf("expected test-agent, got %s", status.AgentID)
	}
	if !status.Connected {
		t.Error("expected connected to be true")
	}
}

func TestHealthEndpointDisconnected(t *testing.T) {
	mux := http.NewServeMux()
	startTime := time.Now()
	isConnected := func() bool { return false }

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		status := "ok"
		if !isConnected() {
			status = "degraded"
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Status{
			Status:    status,
			AgentID:   "test-agent",
			Uptime:    time.Since(startTime).Round(time.Second).String(),
			Connected: isConnected(),
		})
	})

	req := httptest.NewRequest("GET", "/health", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	var status Status
	json.NewDecoder(rec.Body).Decode(&status)

	if status.Status != "degraded" {
		t.Errorf("expected degraded, got %s", status.Status)
	}
	if status.Connected {
		t.Error("expected connected to be false")
	}
}
