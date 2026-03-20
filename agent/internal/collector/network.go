package collector

import (
	"github.com/shirou/gopsutil/v3/net"
)

func collectNetwork() (*NetworkMetrics, error) {
	counters, err := net.IOCounters(false) // false = aggregate all interfaces
	if err != nil {
		return nil, err
	}

	if len(counters) == 0 {
		return &NetworkMetrics{}, nil
	}

	total := counters[0]
	return &NetworkMetrics{
		BytesSent:   total.BytesSent,
		BytesRecv:   total.BytesRecv,
		PacketsSent: total.PacketsSent,
		PacketsRecv: total.PacketsRecv,
	}, nil
}
