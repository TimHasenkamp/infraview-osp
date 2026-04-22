package collector

import (
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/disk"
)

var (
	ioMu       sync.Mutex
	lastIORead uint64
	lastIOWrite uint64
	lastIOTime  time.Time
)

func collectDisk(path string) (*DiskMetrics, error) {
	d, err := disk.Usage(path)
	if err != nil {
		return nil, err
	}

	readPS, writePS := collectDiskIO()

	return &DiskMetrics{
		UsagePercent: round(d.UsedPercent, 1),
		TotalBytes:   d.Total,
		UsedBytes:    d.Used,
		FreeBytes:    d.Free,
		Path:         path,
		ReadBytesPS:  readPS,
		WriteBytesPS: writePS,
	}, nil
}

func collectDiskIO() (readPS, writePS float64) {
	counters, err := disk.IOCounters()
	if err != nil {
		return 0, 0
	}

	var totalRead, totalWrite uint64
	for _, c := range counters {
		totalRead += c.ReadBytes
		totalWrite += c.WriteBytes
	}

	ioMu.Lock()
	defer ioMu.Unlock()

	now := time.Now()
	if !lastIOTime.IsZero() {
		elapsed := now.Sub(lastIOTime).Seconds()
		if elapsed > 0 {
			readPS = float64(totalRead-lastIORead) / elapsed
			writePS = float64(totalWrite-lastIOWrite) / elapsed
		}
	}
	lastIORead = totalRead
	lastIOWrite = totalWrite
	lastIOTime = now
	return readPS, writePS
}
