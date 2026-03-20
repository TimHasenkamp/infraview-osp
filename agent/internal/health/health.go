package health

import (
	"encoding/json"
	"net/http"
	"time"
)

type Status struct {
	Status    string `json:"status"`
	AgentID   string `json:"agent_id"`
	Uptime    string `json:"uptime"`
	Connected bool   `json:"connected"`
}

func StartHealthServer(addr string, agentID string, startTime time.Time, isConnected func() bool) {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		status := "ok"
		if !isConnected() {
			status = "degraded"
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Status{
			Status:    status,
			AgentID:   agentID,
			Uptime:    time.Since(startTime).Round(time.Second).String(),
			Connected: isConnected(),
		})
	})

	go http.ListenAndServe(addr, mux)
}
