package collector

import (
	"os"
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
	Available      int             `json:"available"`
	Security       int             `json:"security"`
	Packages       []PackageUpdate `json:"packages"`
	LastCheck      int64           `json:"last_check"`
	AptAvailable   bool            `json:"apt_available"`   // kept for API compatibility — true if any package manager found
	PackageManager string          `json:"package_manager"` // "apt", "pacman", "dnf", "zypper", "apk", ""
	AgentMode      string          `json:"agent_mode"`      // "container" or "native"
	OsName         string          `json:"os_name"`         // from /etc/os-release PRETTY_NAME
}

const agentModeContainer = "container"
const agentModeNative = "native"

var (
	cachedUpdates *UpdatesInfo
	updatesMu     sync.Mutex
	lastCheckTime time.Time
	checkInterval = 30 * time.Minute

	// inContainer is computed once at startup — container status never changes at runtime.
	inContainer = func() bool {
		_, err := os.Stat("/.dockerenv")
		return err == nil
	}()
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

	if cachedUpdates != nil && time.Since(lastCheckTime) < checkInterval {
		return cachedUpdates
	}

	agentMode := agentModeNative
	if inContainer {
		agentMode = agentModeContainer
	}

	result := &UpdatesInfo{
		LastCheck: time.Now().Unix(),
		Packages:  []PackageUpdate{},
		AgentMode: agentMode,
		OsName:    collectOSName(),
	}

	type detector struct {
		name    string
		collect func() ([]PackageUpdate, bool)
	}

	for _, m := range []detector{
		{"apt", collectApt},
		{"pacman", collectPacman},
		{"dnf", collectDnf},
		{"zypper", collectZypper},
		{"apk", collectApk},
	} {
		if pkgs, ok := m.collect(); ok {
			result.PackageManager = m.name
			result.AptAvailable = true
			result.Packages = pkgs
			result.Available = len(pkgs)
			for _, p := range pkgs {
				if p.Security {
					result.Security++
				}
			}
			break
		}
	}

	cachedUpdates = result
	lastCheckTime = time.Now()
	return result
}

// collectOSName reads /etc/os-release and returns PRETTY_NAME (or NAME as fallback).
func collectOSName() string {
	data, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return ""
	}
	var name string
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "PRETTY_NAME=") {
			return strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), `"`)
		}
		if strings.HasPrefix(line, "NAME=") && name == "" {
			name = strings.Trim(strings.TrimPrefix(line, "NAME="), `"`)
		}
	}
	return name
}

// findCommand returns the first available binary name from the candidates list.
func findCommand(candidates ...string) (string, bool) {
	for _, name := range candidates {
		if _, err := exec.LookPath(name); err == nil {
			return name, true
		}
	}
	return "", false
}

// parseLines runs parser over each non-empty line of output and returns matching packages.
func parseLines(output []byte, parser func(string) PackageUpdate) []PackageUpdate {
	var pkgs []PackageUpdate
	for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
		if p := parser(line); p.Name != "" {
			pkgs = append(pkgs, p)
		}
	}
	return pkgs
}

// apt / apt-get — Debian, Ubuntu
func collectApt() ([]PackageUpdate, bool) {
	// In container mode, HOST_APT must be mounted — otherwise we'd only
	// check the container's own (nearly empty) package list, not the host's.
	if inContainer && os.Getenv("HOST_APT") == "" {
		return nil, false
	}
	if _, ok := findCommand("apt", "apt-get"); !ok {
		return nil, false
	}

	// If HOST_APT is set, verify the host's dpkg status file exists and has
	// content. An empty or missing file means the host doesn't use apt/dpkg
	// (e.g. Arch Linux), so don't report false "up to date".
	if hostApt := os.Getenv("HOST_APT"); hostApt != "" {
		info, err := os.Stat(hostApt + "/dpkg/status")
		if err != nil || info.Size() == 0 {
			return nil, false
		}
	}

	args := []string{"list", "--upgradable"}
	if hostApt := os.Getenv("HOST_APT"); hostApt != "" {
		args = append(args,
			"-o", "Dir::State::status="+hostApt+"/dpkg/status",
			"-o", "Dir::State::Lists="+hostApt+"/lists",
			"-o", "Dir::Etc="+hostApt+"/etc-apt",
		)
	}
	cmd := exec.Command("apt", args...)
	cmd.Env = append(cmd.Environ(), "LANG=C")
	output, err := cmd.Output()
	if err != nil {
		return []PackageUpdate{}, true
	}
	return parseLines(output, parseAptLine), true
}

// pacman — Arch Linux
// Uses `checkupdates` (pacman-contrib) if available, falls back to `pacman -Qu`.
func collectPacman() ([]PackageUpdate, bool) {
	var cmd *exec.Cmd
	if _, err := exec.LookPath("checkupdates"); err == nil {
		cmd = exec.Command("checkupdates")
	} else if _, err := exec.LookPath("pacman"); err == nil {
		cmd = exec.Command("pacman", "-Qu", "--noconfirm")
	} else {
		return nil, false
	}

	output, _ := cmd.Output() // checkupdates exits 2 when no updates — not an error
	if len(output) == 0 {
		return []PackageUpdate{}, true
	}
	return parseLines(output, parsePacmanLine), true
}

// dnf / yum — Fedora, RHEL, CentOS
func collectDnf() ([]PackageUpdate, bool) {
	bin, ok := findCommand("dnf", "yum")
	if !ok {
		return nil, false
	}

	cmd := exec.Command(bin, "check-update", "-q", "--color=never")
	output, err := cmd.Output()
	// dnf exits 100 when updates are available — that's expected
	if err != nil && cmd.ProcessState != nil && cmd.ProcessState.ExitCode() != 100 {
		return []PackageUpdate{}, true
	}
	return parseLines(output, parseDnfLine), true
}

// zypper — openSUSE
func collectZypper() ([]PackageUpdate, bool) {
	if _, ok := findCommand("zypper"); !ok {
		return nil, false
	}

	cmd := exec.Command("zypper", "-q", "list-updates")
	output, err := cmd.Output()
	if err != nil {
		return []PackageUpdate{}, true
	}
	return parseLines(output, parseZypperLine), true
}

// apk — Alpine Linux
func collectApk() ([]PackageUpdate, bool) {
	if _, ok := findCommand("apk"); !ok {
		return nil, false
	}

	cmd := exec.Command("apk", "version", "-l", "<")
	output, err := cmd.Output()
	if err != nil {
		return []PackageUpdate{}, true
	}
	return parseLines(output, parseApkLine), true
}

// parseAptLine parses: package/source 1.2.3 amd64 [upgradable from: 1.2.2]
func parseAptLine(line string) PackageUpdate {
	slashIdx := strings.Index(line, "/")
	if slashIdx < 0 {
		return PackageUpdate{}
	}
	pkg := PackageUpdate{Name: line[:slashIdx]}

	spaceIdx := strings.Index(line[slashIdx:], " ")
	if spaceIdx > 0 {
		pkg.Security = strings.Contains(line[slashIdx+1:slashIdx+spaceIdx], "security")
	}
	if parts := strings.Fields(line[slashIdx+spaceIdx+1:]); len(parts) > 0 {
		pkg.NewVersion = parts[0]
	}
	if fromIdx := strings.Index(line, "upgradable from: "); fromIdx > 0 {
		pkg.CurrentVersion = strings.TrimSuffix(line[fromIdx+len("upgradable from: "):], "]")
	}
	return pkg
}

// parsePacmanLine parses: packagename oldver -> newver
func parsePacmanLine(line string) PackageUpdate {
	parts := strings.Fields(line)
	if len(parts) < 4 || parts[2] != "->" {
		return PackageUpdate{}
	}
	return PackageUpdate{Name: parts[0], CurrentVersion: parts[1], NewVersion: parts[3]}
}

// parseDnfLine parses: packagename.arch newversion repo
func parseDnfLine(line string) PackageUpdate {
	parts := strings.Fields(line)
	if len(parts) < 3 || strings.HasPrefix(line, " ") {
		return PackageUpdate{}
	}
	name := parts[0]
	if dotIdx := strings.LastIndex(name, "."); dotIdx > 0 {
		name = name[:dotIdx]
	}
	return PackageUpdate{Name: name, NewVersion: parts[1]}
}

// parseZypperLine parses zypper list-updates table rows: | name | repo | cur | new | arch
func parseZypperLine(line string) PackageUpdate {
	if !strings.HasPrefix(line, "|") {
		return PackageUpdate{}
	}
	cols := strings.Split(line, "|")
	if len(cols) < 5 {
		return PackageUpdate{}
	}
	name := strings.TrimSpace(cols[1])
	if name == "" || name == "Name" {
		return PackageUpdate{}
	}
	return PackageUpdate{
		Name:           name,
		CurrentVersion: strings.TrimSpace(cols[3]),
		NewVersion:     strings.TrimSpace(cols[4]),
	}
}

// parseApkLine parses: packagename-currentver < newver
func parseApkLine(line string) PackageUpdate {
	parts := strings.Fields(line)
	if len(parts) < 3 || parts[1] != "<" {
		return PackageUpdate{}
	}
	nameVer := parts[0]
	for i := len(nameVer) - 1; i > 0; i-- {
		if nameVer[i] == '-' && i+1 < len(nameVer) && nameVer[i+1] >= '0' && nameVer[i+1] <= '9' {
			return PackageUpdate{Name: nameVer[:i], CurrentVersion: nameVer[i+1:], NewVersion: parts[2]}
		}
	}
	return PackageUpdate{}
}
