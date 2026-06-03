package collector

import (
	"sync"
	"time"
)

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
	ReadBytesPS  float64 `json:"read_bytes_ps"`
	WriteBytesPS float64 `json:"write_bytes_ps"`
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
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	Image           string  `json:"image"`
	State           string  `json:"state"`
	Status          string  `json:"status"`
	Created         int64   `json:"created"`
	UpdateAvailable bool    `json:"update_available"`
	LatestVersion   string  `json:"latest_version,omitempty"`
	CPUPercent      float64 `json:"cpu_percent"`
	MemoryBytes     uint64  `json:"memory_bytes"`
	MemoryLimit     uint64  `json:"memory_limit"`
}

type SystemSnapshot struct {
	Timestamp  int64           `json:"timestamp"`
	Hostname   string          `json:"hostname"`
	AgentID    string          `json:"agent_id"`
	PublicIP   string          `json:"public_ip,omitempty"`
	CPU        CPUMetrics      `json:"cpu"`
	Memory     MemoryMetrics   `json:"memory"`
	Disk       DiskMetrics     `json:"disk"`
	Network    NetworkMetrics  `json:"network"`
	Load       LoadMetrics     `json:"load"`
	Processes  []ProcessInfo  `json:"processes"`
	Updates    *UpdatesInfo   `json:"updates"`
	Containers []ContainerInfo `json:"containers"`
}

const publicIPTTL = 30 * time.Minute

type Collector struct {
	agentID  string
	hostname string
	diskPath string

	mu         sync.Mutex
	publicIP   string
	publicIPAt time.Time
	ipFetching bool
}

func New(agentID, hostname, diskPath string) *Collector {
	c := &Collector{
		agentID:  agentID,
		hostname: hostname,
		diskPath: diskPath,
	}
	// Fetch in the background so a slow/failing lookup doesn't delay startup.
	c.maybeRefreshPublicIP()
	return c
}

// publicIPValue returns the cached public IP and triggers a background refresh
// when it is empty or stale. Fetching only once at startup meant a transient
// failure left the IP blank forever; this self-heals without blocking Collect().
func (c *Collector) publicIPValue() string {
	c.mu.Lock()
	ip := c.publicIP
	c.mu.Unlock()
	c.maybeRefreshPublicIP()
	return ip
}

func (c *Collector) maybeRefreshPublicIP() {
	c.mu.Lock()
	stale := c.publicIP == "" || time.Since(c.publicIPAt) > publicIPTTL
	if !stale || c.ipFetching {
		c.mu.Unlock()
		return
	}
	c.ipFetching = true
	c.mu.Unlock()

	go func() {
		ip := fetchPublicIP()
		c.mu.Lock()
		if ip != "" {
			// Keep the last known good value if the lookup failed.
			c.publicIP = ip
			c.publicIPAt = time.Now()
		}
		c.ipFetching = false
		c.mu.Unlock()
	}()
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
		PublicIP:   c.publicIPValue(),
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
