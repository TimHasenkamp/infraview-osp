package collector

import (
	"sort"

	"github.com/shirou/gopsutil/v3/process"
)

func collectProcesses(topN int) ([]ProcessInfo, error) {
	procs, err := process.Processes()
	if err != nil {
		return nil, err
	}

	var infos []ProcessInfo
	for _, p := range procs {
		name, err := p.Name()
		if err != nil || name == "" {
			continue
		}

		cpuPct, _ := p.CPUPercent()
		memPct, _ := p.MemoryPercent()
		memInfo, _ := p.MemoryInfo()
		user, _ := p.Username()

		var memBytes uint64
		if memInfo != nil {
			memBytes = memInfo.RSS
		}

		infos = append(infos, ProcessInfo{
			PID:        p.Pid,
			Name:       name,
			CPUPercent: cpuPct,
			MemPercent: memPct,
			MemBytes:   memBytes,
			User:       user,
		})
	}

	// Sort by CPU descending, then by memory
	sort.Slice(infos, func(i, j int) bool {
		if infos[i].CPUPercent != infos[j].CPUPercent {
			return infos[i].CPUPercent > infos[j].CPUPercent
		}
		return infos[i].MemBytes > infos[j].MemBytes
	})

	if len(infos) > topN {
		infos = infos[:topN]
	}

	return infos, nil
}
