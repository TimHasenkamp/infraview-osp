package collector

import (
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
)

func collectCPU() (*CPUMetrics, error) {
	perCore, err := cpu.Percent(time.Second, true)
	if err != nil {
		return nil, err
	}

	overall, err := cpu.Percent(0, false)
	if err != nil {
		return nil, err
	}

	usage := 0.0
	if len(overall) > 0 {
		usage = overall[0]
	}

	return &CPUMetrics{
		UsagePercent: round(usage, 1),
		CoreCount:    runtime.NumCPU(),
		PerCore:      roundSlice(perCore, 1),
	}, nil
}

func round(val float64, precision int) float64 {
	p := 1.0
	for i := 0; i < precision; i++ {
		p *= 10
	}
	return float64(int(val*p+0.5)) / p
}

func roundSlice(vals []float64, precision int) []float64 {
	result := make([]float64, len(vals))
	for i, v := range vals {
		result[i] = round(v, precision)
	}
	return result
}
