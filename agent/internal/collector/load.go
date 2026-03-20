package collector

import (
	"github.com/shirou/gopsutil/v3/load"
)

func collectLoad() (*LoadMetrics, error) {
	avg, err := load.Avg()
	if err != nil {
		return nil, err
	}

	return &LoadMetrics{
		Load1:  avg.Load1,
		Load5:  avg.Load5,
		Load15: avg.Load15,
	}, nil
}
