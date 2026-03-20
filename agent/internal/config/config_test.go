package config

import (
	"os"
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	// Clear any env vars that might interfere
	os.Unsetenv("INFRAVIEW_BACKEND_URL")
	os.Unsetenv("INFRAVIEW_AGENT_ID")
	os.Unsetenv("INFRAVIEW_INTERVAL")
	os.Unsetenv("INFRAVIEW_DISK_PATH")
	os.Unsetenv("INFRAVIEW_API_KEY")

	cfg := Load()

	if cfg.BackendURL != "ws://localhost:8000/ws/agent" {
		t.Errorf("expected default BackendURL, got %s", cfg.BackendURL)
	}
	if cfg.Interval != 5 {
		t.Errorf("expected default interval 5, got %d", cfg.Interval)
	}
	if cfg.DiskPath != "/" {
		t.Errorf("expected default disk path /, got %s", cfg.DiskPath)
	}
	if cfg.AgentID == "" {
		t.Error("expected AgentID to be set from hostname")
	}
}

func TestLoadFromEnv(t *testing.T) {
	os.Setenv("INFRAVIEW_BACKEND_URL", "ws://custom:9000/ws/agent")
	os.Setenv("INFRAVIEW_AGENT_ID", "test-agent")
	os.Setenv("INFRAVIEW_INTERVAL", "10")
	os.Setenv("INFRAVIEW_DISK_PATH", "/data")
	os.Setenv("INFRAVIEW_API_KEY", "secret-key")
	defer func() {
		os.Unsetenv("INFRAVIEW_BACKEND_URL")
		os.Unsetenv("INFRAVIEW_AGENT_ID")
		os.Unsetenv("INFRAVIEW_INTERVAL")
		os.Unsetenv("INFRAVIEW_DISK_PATH")
		os.Unsetenv("INFRAVIEW_API_KEY")
	}()

	cfg := Load()

	if cfg.BackendURL != "ws://custom:9000/ws/agent" {
		t.Errorf("expected custom BackendURL, got %s", cfg.BackendURL)
	}
	if cfg.AgentID != "test-agent" {
		t.Errorf("expected test-agent, got %s", cfg.AgentID)
	}
	if cfg.Interval != 10 {
		t.Errorf("expected interval 10, got %d", cfg.Interval)
	}
	if cfg.DiskPath != "/data" {
		t.Errorf("expected /data, got %s", cfg.DiskPath)
	}
	if cfg.APIKey != "secret-key" {
		t.Errorf("expected secret-key, got %s", cfg.APIKey)
	}
}

func TestLoadInvalidInterval(t *testing.T) {
	os.Setenv("INFRAVIEW_INTERVAL", "notanumber")
	defer os.Unsetenv("INFRAVIEW_INTERVAL")

	cfg := Load()
	if cfg.Interval != 5 {
		t.Errorf("expected fallback interval 5 for invalid input, got %d", cfg.Interval)
	}
}

func TestGetEnv(t *testing.T) {
	os.Setenv("TEST_KEY", "value")
	defer os.Unsetenv("TEST_KEY")

	if v := getEnv("TEST_KEY", "default"); v != "value" {
		t.Errorf("expected value, got %s", v)
	}
	if v := getEnv("NONEXISTENT_KEY", "default"); v != "default" {
		t.Errorf("expected default, got %s", v)
	}
}

func TestGetEnvInt(t *testing.T) {
	os.Setenv("TEST_INT", "42")
	defer os.Unsetenv("TEST_INT")

	if v := getEnvInt("TEST_INT", 0); v != 42 {
		t.Errorf("expected 42, got %d", v)
	}
	if v := getEnvInt("NONEXISTENT", 99); v != 99 {
		t.Errorf("expected 99, got %d", v)
	}
}
