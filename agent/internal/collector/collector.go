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

type NetworkMetrics struct {
	BytesSent   uint64 `json:"bytes_sent"`
	BytesRecv   uint64 `json:"bytes_recv"`
	PacketsSent uint64 `json:"packets_sent"`
	PacketsRecv uint64 `json:"packets_recv"`
}

type LoadMetrics struct {
	Load1  float64 `json:"load1"`
	Load5  float64 `json:"load5"`
	Load15 float64 `json:"load15"`
}

type ProcessInfo struct {
	PID        int32   `json:"pid"`
	Name       string  `json:"name"`
	CPUPercent float64 `json:"cpu_percent"`
	MemPercent float32 `json:"mem_percent"`
	MemBytes   uint64  `json:"mem_bytes"`
	User       string  `json:"user"`
}

type ContainerInfo struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Image           string `json:"image"`
	State           string `json:"state"`
	Status          string `json:"status"`
	Created         int64  `json:"created"`
	UpdateAvailable bool   `json:"update_available"`
	LatestVersion   string `json:"latest_version,omitempty"`
}

type SystemSnapshot struct {
	Timestamp  int64           `json:"timestamp"`
	Hostname   string          `json:"hostname"`
	AgentID    string          `json:"agent_id"`
	CPU        CPUMetrics      `json:"cpu"`
	Memory     MemoryMetrics   `json:"memory"`
	Disk       DiskMetrics     `json:"disk"`
	Network    NetworkMetrics  `json:"network"`
	Load       LoadMetrics     `json:"load"`
	Processes  []ProcessInfo  `json:"processes"`
	Updates    *UpdatesInfo   `json:"updates"`
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

	net, err := collectNetwork()
	if err != nil {
		return nil, err
	}

	ld, err := collectLoad()
	if err != nil {
		// Load averages may not be available on all platforms (e.g. Windows)
		ld = &LoadMetrics{}
	}

	procs, err := collectProcesses(10)
	if err != nil {
		procs = []ProcessInfo{}
	}

	updates := collectUpdates()

	return &SystemSnapshot{
		Timestamp:  time.Now().Unix(),
		Hostname:   c.hostname,
		AgentID:    c.agentID,
		CPU:        *cpu,
		Memory:     *mem,
		Disk:       *disk,
		Network:    *net,
		Load:       *ld,
		Processes:  procs,
		Updates:    updates,
		Containers: []ContainerInfo{},
	}, nil
}
