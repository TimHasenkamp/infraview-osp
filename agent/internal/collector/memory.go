package collector

import "github.com/shirou/gopsutil/v3/mem"

func collectMemory() (*MemoryMetrics, error) {
	v, err := mem.VirtualMemory()
	if err != nil {
		return nil, err
	}

	return &MemoryMetrics{
		UsagePercent: round(v.UsedPercent, 1),
		TotalBytes:   v.Total,
		UsedBytes:    v.Used,
		AvailBytes:   v.Available,
	}, nil
}
