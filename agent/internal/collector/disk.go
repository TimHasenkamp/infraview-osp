package collector

import "github.com/shirou/gopsutil/v3/disk"

func collectDisk(path string) (*DiskMetrics, error) {
	d, err := disk.Usage(path)
	if err != nil {
		return nil, err
	}

	return &DiskMetrics{
		UsagePercent: round(d.UsedPercent, 1),
		TotalBytes:   d.Total,
		UsedBytes:    d.Used,
		FreeBytes:    d.Free,
		Path:         path,
	}, nil
}
