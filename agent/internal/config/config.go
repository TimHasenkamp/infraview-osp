package config

import (
	"os"
	"strconv"
)

type Config struct {
	BackendURL string
	AgentID    string
	Interval   int
	DiskPath   string
}

func Load() *Config {
	c := &Config{
		BackendURL: getEnv("INFRAVIEW_BACKEND_URL", "ws://localhost:8000/ws/agent"),
		AgentID:    getEnv("INFRAVIEW_AGENT_ID", ""),
		Interval:   getEnvInt("INFRAVIEW_INTERVAL", 5),
		DiskPath:   getEnv("INFRAVIEW_DISK_PATH", "/"),
	}

	if c.AgentID == "" {
		hostname, err := os.Hostname()
		if err != nil {
			c.AgentID = "unknown"
		} else {
			c.AgentID = hostname
		}
	}

	return c
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}
