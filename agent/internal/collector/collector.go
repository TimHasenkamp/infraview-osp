package collector

import "time"

type CPUMetrics struct {
	UsagePercent float64   `json:"usage_percent"`
	CoreCount    int       `json:"core_count"`
	PerCore      []float64 `json:"per_core"`
}

type MemoryMetrics struct {
	UsagePercent float64 `json:"usage_percent"`
	TotalBytes   uint64  `json:"total_bytes"`
	UsedBytes    uint64  `json:"used_bytes"`
	AvailBytes   uint64  `json:"avail_bytes"`
}

type DiskMetrics struct {
	UsagePercent float64 `json:"usage_percent"`
	TotalBytes   uint64  `json:"total_bytes"`
	UsedBytes    uint64  `json:"used_bytes"`
	FreeBytes    uint64  `json:"free_bytes"`
	Path         string  `json:"path"`
}

type ContainerInfo struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Image   string `json:"image"`
	State   string `json:"state"`
	Status  string `json:"status"`
	Created int64  `json:"created"`
}

type SystemSnapshot struct {
	Timestamp  int64           `json:"timestamp"`
	Hostname   string          `json:"hostname"`
	AgentID    string          `json:"agent_id"`
	CPU        CPUMetrics      `json:"cpu"`
	Memory     MemoryMetrics   `json:"memory"`
	Disk       DiskMetrics     `json:"disk"`
	Containers []ContainerInfo `json:"containers"`
}

type Collector struct {
	agentID  string
	hostname string
	diskPath string
}

func New(agentID, hostname, diskPath string) *Collector {
	return &Collector{
		agentID:  agentID,
		hostname: hostname,
		diskPath: diskPath,
	}
}

func (c *Collector) Collect() (*SystemSnapshot, error) {
	cpu, err := collectCPU()
	if err != nil {
		return nil, err
	}

	mem, err := collectMemory()
	if err != nil {
		return nil, err
	}

	disk, err := collectDisk(c.diskPath)
	if err != nil {
		return nil, err
	}

	return &SystemSnapshot{
		Timestamp: time.Now().Unix(),
		Hostname:  c.hostname,
		AgentID:   c.agentID,
		CPU:       *cpu,
		Memory:    *mem,
		Disk:      *disk,
	}, nil
}
