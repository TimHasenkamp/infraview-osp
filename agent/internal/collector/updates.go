package collector

import (
	"os/exec"
	"strings"
	"sync"
	"time"
)

type PackageUpdate struct {
	Name           string `json:"name"`
	CurrentVersion string `json:"current_version"`
	NewVersion     string `json:"new_version"`
	Security       bool   `json:"security"`
}

type UpdatesInfo struct {
	Available    int             `json:"available"`
	Security     int             `json:"security"`
	Packages     []PackageUpdate `json:"packages"`
	LastCheck    int64           `json:"last_check"`
	AptAvailable bool            `json:"apt_available"`
}

var (
	cachedUpdates *UpdatesInfo
	updatesMu     sync.Mutex
	lastCheckTime time.Time
	checkInterval = 30 * time.Minute
)

func ClearUpdatesCache() {
	updatesMu.Lock()
	cachedUpdates = nil
	lastCheckTime = time.Time{}
	updatesMu.Unlock()
}

func collectUpdates() *UpdatesInfo {
	updatesMu.Lock()
	defer updatesMu.Unlock()

	// Return cache if still fresh
	if cachedUpdates != nil && time.Since(lastCheckTime) < checkInterval {
		return cachedUpdates
	}

	result := &UpdatesInfo{
		LastCheck: time.Now().Unix(),
		Packages:  []PackageUpdate{},
	}

	// Check if apt is available
	aptPath, err := exec.LookPath("apt")
	if err != nil {
		aptPath, err = exec.LookPath("apt-get")
		if err != nil {
			// Not a Debian/Ubuntu system — report as unavailable
			result.AptAvailable = false
			cachedUpdates = result
			lastCheckTime = time.Now()
			return result
		}
	}
	_ = aptPath
	result.AptAvailable = true

	// Get upgradable packages
	cmd := exec.Command("apt", "list", "--upgradable")
	cmd.Env = append(cmd.Environ(), "LANG=C")
	output, err := cmd.Output()
	if err != nil {
		cachedUpdates = result
		lastCheckTime = time.Now()
		return result
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	for _, line := range lines {
		if line == "" || strings.HasPrefix(line, "Listing") {
			continue
		}

		pkg := parseAptLine(line)
		if pkg.Name == "" {
			continue
		}

		result.Packages = append(result.Packages, pkg)
		result.Available++
		if pkg.Security {
			result.Security++
		}
	}

	cachedUpdates = result
	lastCheckTime = time.Now()
	return result
}

// parseAptLine parses a line like:
// package/focal-updates,focal-security 1.2.3-4 amd64 [upgradable from: 1.2.3-3]
func parseAptLine(line string) PackageUpdate {
	pkg := PackageUpdate{}

	// Split "name/source version arch [upgradable from: old_version]"
	slashIdx := strings.Index(line, "/")
	if slashIdx < 0 {
		return pkg
	}
	pkg.Name = line[:slashIdx]

	// Check if it's a security update
	source := ""
	spaceIdx := strings.Index(line[slashIdx:], " ")
	if spaceIdx > 0 {
		source = line[slashIdx+1 : slashIdx+spaceIdx]
	}
	pkg.Security = strings.Contains(source, "security")

	// Extract new version
	rest := line[slashIdx+spaceIdx+1:]
	parts := strings.Fields(rest)
	if len(parts) > 0 {
		pkg.NewVersion = parts[0]
	}

	// Extract old version from "[upgradable from: x.y.z]"
	fromIdx := strings.Index(line, "upgradable from: ")
	if fromIdx > 0 {
		old := line[fromIdx+len("upgradable from: "):]
		old = strings.TrimSuffix(old, "]")
		pkg.CurrentVersion = old
	}

	return pkg
}
