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

// collectOSName returns the host's OS name (PRETTY_NAME, or NAME as fallback).
// In container mode it prefers the host's os-release (bind-mounted in) so it
// reports the actual host OS instead of the agent image's Debian base.
func collectOSName() string {
	for _, path := range osReleaseCandidates() {
		if name := readOSReleaseName(path); name != "" {
			return name
		}
	}
	return ""
}

// osReleaseCandidates lists os-release files to try, best first.
func osReleaseCandidates() []string {
	if inContainer {
		host := os.Getenv("HOST_OS_RELEASE")
		if host == "" {
			host = "/host/os-release"
		}
		// Host first, container's own os-release only as a last resort.
		return []string{host, "/etc/os-release"}
	}
	return []string{"/etc/os-release"}
}

// hostMachineID returns the host's systemd machine-id. apt seeds its phased-
// update decision with it, so the agent must use the host's value to predict
// what `apt upgrade` would actually do. In container mode the host file is
// bind-mounted in; natively the agent's own machine-id is already the host's.
func hostMachineID() string {
	for _, path := range machineIDCandidates() {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		if id := strings.TrimSpace(string(data)); id != "" {
			return id
		}
	}
	return ""
}

// machineIDCandidates lists machine-id files to try, best first.
func machineIDCandidates() []string {
	if inContainer {
		host := os.Getenv("HOST_MACHINE_ID")
		if host == "" {
			host = "/host/machine-id"
		}
		return []string{host}
	}
	return []string{"/etc/machine-id", "/var/lib/dbus/machine-id"}
}

func readOSReleaseName(path string) string {
	data, err := os.ReadFile(path)
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
// Always returns a non-nil slice: a nil slice marshals to JSON null, which the
// backend rejects (packages must be a list).
func parseLines(output []byte, parser func(string) PackageUpdate) []PackageUpdate {
	pkgs := []PackageUpdate{}
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
		args = append(args, aptStateArgs(hostApt)...)
	}
	cmd := exec.Command("apt", args...)
	cmd.Env = append(cmd.Environ(), "LANG=C")
	output, err := cmd.Output()
	if err != nil {
		return []PackageUpdate{}, true
	}
	pkgs := parseLines(output, parseAptLine)

	// Drop packages apt is deferring due to phased rollout: they appear in
	// `apt list --upgradable` but `apt upgrade` keeps them back, so counting
	// them as available updates is misleading (e.g. cloud-init on Ubuntu).
	return filterPhased(pkgs, aptPhasedPackages()), true
}

// aptStateArgs returns apt -o overrides pointing at the bind-mounted host
// apt/dpkg directories, so a containerized agent inspects the host's packages
// instead of its own (nearly empty) ones.
func aptStateArgs(hostApt string) []string {
	return []string{
		"-o", "Dir::State::status=" + hostApt + "/dpkg/status",
		"-o", "Dir::State::Lists=" + hostApt + "/lists",
		"-o", "Dir::Etc=" + hostApt + "/etc-apt",
	}
}

// aptPhasedPackages returns the set of package names apt is deferring due to a
// phased rollout. Ubuntu ships -updates gradually, so these show up in
// `apt list --upgradable` but are kept back by `apt upgrade`.
func aptPhasedPackages() map[string]bool {
	bin, ok := findCommand("apt-get", "apt")
	if !ok {
		return nil
	}
	args := []string{"-s", "upgrade"}
	// apt's phasing decision is per-machine (seeded by the machine-id). A
	// containerized agent has a different machine-id than the host, so pass the
	// host's explicitly — otherwise the simulate computes the wrong rollout
	// bucket and misses deferrals. Needs apt >= 3.0 (debian:13 base) to honor it.
	if id := hostMachineID(); id != "" {
		args = append(args, "-o", "APT::Machine-ID="+id)
	}
	if hostApt := os.Getenv("HOST_APT"); hostApt != "" {
		args = append(args, aptStateArgs(hostApt)...)
	}
	cmd := exec.Command(bin, args...)
	cmd.Env = append(cmd.Environ(), "LANG=C")
	output, err := cmd.Output()
	if err != nil {
		return nil
	}
	return parseAptPhased(output)
}

// parseAptPhased extracts the package names under the "deferred due to phasing"
// section of `apt-get -s upgrade` output.
func parseAptPhased(output []byte) map[string]bool {
	phased := map[string]bool{}
	inSection := false
	for _, line := range strings.Split(string(output), "\n") {
		if strings.Contains(line, "deferred due to phasing") {
			inSection = true
			continue
		}
		if !inSection {
			continue
		}
		// Entries are indented; the section ends at the first non-indented line.
		if !strings.HasPrefix(line, " ") {
			break
		}
		for _, name := range strings.Fields(line) {
			phased[name] = true
		}
	}
	return phased
}

// filterPhased removes any package whose name is in the phased set.
func filterPhased(pkgs []PackageUpdate, phased map[string]bool) []PackageUpdate {
	if len(phased) == 0 {
		return pkgs
	}
	filtered := pkgs[:0]
	for _, p := range pkgs {
		if !phased[p.Name] {
			filtered = append(filtered, p)
		}
	}
	return filtered
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
