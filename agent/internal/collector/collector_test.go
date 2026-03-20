package collector

import (
	"testing"
)

func TestNewCollector(t *testing.T) {
	c := New("agent-1", "testhost", "/")
	if c.agentID != "agent-1" {
		t.Errorf("expected agent-1, got %s", c.agentID)
	}
	if c.hostname != "testhost" {
		t.Errorf("expected testhost, got %s", c.hostname)
	}
	if c.diskPath != "/" {
		t.Errorf("expected /, got %s", c.diskPath)
	}
}

func TestCollect(t *testing.T) {
	c := New("test", "localhost", "/")
	snapshot, err := c.Collect()
	if err != nil {
		t.Fatalf("Collect() failed: %v", err)
	}

	if snapshot.AgentID != "test" {
		t.Errorf("expected agent_id test, got %s", snapshot.AgentID)
	}
	if snapshot.Hostname != "localhost" {
		t.Errorf("expected hostname localhost, got %s", snapshot.Hostname)
	}
	if snapshot.Timestamp <= 0 {
		t.Error("expected positive timestamp")
	}

	// CPU should have valid data
	if snapshot.CPU.CoreCount <= 0 {
		t.Error("expected positive core count")
	}
	if snapshot.CPU.UsagePercent < 0 || snapshot.CPU.UsagePercent > 100 {
		t.Errorf("CPU usage out of range: %f", snapshot.CPU.UsagePercent)
	}

	// Memory should have valid data
	if snapshot.Memory.TotalBytes == 0 {
		t.Error("expected non-zero total memory")
	}
	if snapshot.Memory.UsagePercent < 0 || snapshot.Memory.UsagePercent > 100 {
		t.Errorf("Memory usage out of range: %f", snapshot.Memory.UsagePercent)
	}

	// Disk should have valid data
	if snapshot.Disk.TotalBytes == 0 {
		t.Error("expected non-zero total disk")
	}

	// Processes should be populated
	if len(snapshot.Processes) == 0 {
		t.Error("expected at least one process")
	}
	if len(snapshot.Processes) > 10 {
		t.Errorf("expected at most 10 processes, got %d", len(snapshot.Processes))
	}
}

func TestCollectCPU(t *testing.T) {
	cpu, err := collectCPU()
	if err != nil {
		t.Fatalf("collectCPU() failed: %v", err)
	}
	if cpu.CoreCount <= 0 {
		t.Error("expected positive core count")
	}
}

func TestCollectMemory(t *testing.T) {
	mem, err := collectMemory()
	if err != nil {
		t.Fatalf("collectMemory() failed: %v", err)
	}
	if mem.TotalBytes == 0 {
		t.Error("expected non-zero memory")
	}
	if mem.UsedBytes > mem.TotalBytes {
		t.Error("used bytes should not exceed total")
	}
}

func TestCollectDisk(t *testing.T) {
	disk, err := collectDisk("/")
	if err != nil {
		t.Fatalf("collectDisk() failed: %v", err)
	}
	if disk.TotalBytes == 0 {
		t.Error("expected non-zero disk total")
	}
}

func TestCollectNetwork(t *testing.T) {
	net, err := collectNetwork()
	if err != nil {
		t.Fatalf("collectNetwork() failed: %v", err)
	}
	// Network counters should be non-negative (they're uint64)
	_ = net.BytesSent
	_ = net.BytesRecv
}

func TestCollectProcesses(t *testing.T) {
	procs, err := collectProcesses(5)
	if err != nil {
		t.Fatalf("collectProcesses() failed: %v", err)
	}
	if len(procs) == 0 {
		t.Error("expected at least one process")
	}
	if len(procs) > 5 {
		t.Errorf("expected at most 5 processes, got %d", len(procs))
	}

	// Processes should be sorted by CPU descending
	for i := 1; i < len(procs); i++ {
		if procs[i].CPUPercent > procs[i-1].CPUPercent {
			// Allow equal CPU with different memory ordering
			if procs[i].CPUPercent != procs[i-1].CPUPercent {
				t.Error("processes should be sorted by CPU descending")
			}
		}
	}
}
