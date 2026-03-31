package updater

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	containerTypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/rs/zerolog/log"
)

const (
	agentImage   = "ghcr.io/timhasenkamp/infraview-osp/agent:latest"
	nativeBinary = "/usr/local/bin/infraview-agent"
	releaseBase  = "https://github.com/timhasenkamp/infraview-osp/releases/latest/download"
)

// StatusFunc sends a self_update_response back to the backend.
type StatusFunc func(status, message string)

// selfContainerID returns the Docker container ID of the running process.
// It first tries HOSTNAME (works for bridge-networked containers), then falls
// back to parsing /proc/self/cgroup (required for network_mode: host).
func selfContainerID() (string, error) {
	// In bridge mode Docker sets HOSTNAME to the 12-char container ID.
	if id := os.Getenv("HOSTNAME"); len(id) == 12 {
		return id, nil
	}

	// Fallback: parse /proc/self/cgroup.
	// cgroupv1 line example:  12:devices:/docker/abc123...
	// cgroupv2 line example:  0::/system.slice/docker-abc123....scope
	data, err := os.ReadFile("/proc/self/cgroup")
	if err != nil {
		return "", fmt.Errorf("read cgroup: %w", err)
	}
	for _, line := range strings.Split(string(data), "\n") {
		// cgroupv1
		if idx := strings.Index(line, "/docker/"); idx != -1 {
			id := line[idx+len("/docker/"):]
			if len(id) >= 12 {
				return id[:12], nil
			}
		}
		// cgroupv2
		if idx := strings.Index(line, "docker-"); idx != -1 {
			rest := line[idx+len("docker-"):]
			if dot := strings.Index(rest, ".scope"); dot >= 12 {
				return rest[:12], nil
			}
		}
	}
	return "", fmt.Errorf("container ID not found in /proc/self/cgroup")
}

// IsInContainer returns true when the agent is running inside a Docker container.
func IsInContainer() bool {
	_, err := os.Stat("/.dockerenv")
	return err == nil
}

// RunDocker performs a self-update in Docker mode:
//  1. Pull latest image
//  2. If already up-to-date, report and return
//  3. Recreate own container with the new image
//  4. Stop self (restart policy will NOT re-create; new container takes over)
func RunDocker(ctx context.Context, cli *client.Client, sendStatus StatusFunc) {
	sendStatus("pulling", "Pulling latest agent image…")

	reader, err := cli.ImagePull(ctx, agentImage, image.PullOptions{})
	if err != nil {
		sendStatus("error", fmt.Sprintf("Pull failed: %v", err))
		return
	}
	io.Copy(io.Discard, reader)
	reader.Close()

	selfID, err := selfContainerID()
	if err != nil {
		sendStatus("error", fmt.Sprintf("Cannot determine own container ID: %v", err))
		return
	}

	selfInfo, err := cli.ContainerInspect(ctx, selfID)
	if err != nil {
		sendStatus("error", fmt.Sprintf("Cannot inspect self: %v", err))
		return
	}

	newImgInfo, _, err := cli.ImageInspectWithRaw(ctx, agentImage)
	if err != nil {
		sendStatus("error", fmt.Sprintf("Cannot inspect new image: %v", err))
		return
	}

	// Guard: only update containers that were started from the official image.
	// A locally-built dev container has a different image name and must not be
	// replaced by the production image from GHCR.
	if selfInfo.Config.Image != agentImage {
		sendStatus("error", fmt.Sprintf(
			"Self-update is only supported when running the official image (%s). "+
				"This container uses %q — rebuild manually.",
			agentImage, selfInfo.Config.Image,
		))
		return
	}

	if selfInfo.Image == newImgInfo.ID {
		sendStatus("up_to_date", "Already running the latest version")
		return
	}

	sendStatus("restarting", "Starting updated container…")
	log.Info().Str("old_image", selfInfo.Image).Str("new_image", newImgInfo.ID).Msg("Self-updating via Docker")

	// Strip the leading "/" Docker adds to container names ("/agent" → "agent").
	originalName := strings.TrimPrefix(selfInfo.Name, "/")
	tempName := originalName + "-old"

	// Rename self so the new container can claim the original name (and with it
	// the compose service labels that were already copied into selfInfo.Config).
	renamed := true
	if err := cli.ContainerRename(ctx, selfID, tempName); err != nil {
		log.Warn().Err(err).Msg("Could not rename self — new container will get a random name")
		renamed = false
		originalName = "" // Docker assigns a random name
	}

	cfg := selfInfo.Config
	cfg.Image = agentImage

	// For host-networking containers, NetworkSettings.Networks is empty and
	// the mode is already encoded in HostConfig.NetworkMode. Passing a non-nil
	// EndpointsConfig in that case causes a Docker API error, so we only pass
	// the endpoint map for bridge/custom networks.
	var netCfg *network.NetworkingConfig
	if selfInfo.HostConfig.NetworkMode != "host" && len(selfInfo.NetworkSettings.Networks) > 0 {
		netCfg = &network.NetworkingConfig{
			EndpointsConfig: selfInfo.NetworkSettings.Networks,
		}
	}

	resp, err := cli.ContainerCreate(ctx, cfg, selfInfo.HostConfig, netCfg, nil, originalName)
	if err != nil {
		if renamed {
			// Roll back the rename so the original container is still reachable.
			cli.ContainerRename(ctx, selfID, originalName)
		}
		sendStatus("error", fmt.Sprintf("Container create failed: %v", err))
		return
	}

	if err := cli.ContainerStart(ctx, resp.ID, containerTypes.StartOptions{}); err != nil {
		cli.ContainerRemove(ctx, resp.ID, containerTypes.RemoveOptions{Force: true})
		if renamed {
			cli.ContainerRename(ctx, selfID, originalName)
		}
		sendStatus("error", fmt.Sprintf("Container start failed: %v", err))
		return
	}

	// Give the new container a moment to establish its WebSocket connection
	// before we drop the current one.
	time.Sleep(3 * time.Second)

	// Stop self. Using ContainerStop (SIGTERM → SIGKILL after timeout) tells
	// Docker this was an intentional stop, so restart policy won't trigger.
	// The stopped container stays as "<name>-old" and can be removed manually.
	stopTimeout := 5
	cli.ContainerStop(ctx, selfID, containerTypes.StopOptions{Timeout: &stopTimeout})
}

// RunNative performs a self-update in native/systemd mode:
//  1. Download new binary for current arch
//  2. Replace /usr/local/bin/infraview-agent
//  3. systemctl restart infraview-agent  (kills + restarts this process)
func RunNative(ctx context.Context, sendStatus StatusFunc) {
	arch := runtime.GOARCH
	archName := map[string]string{
		"amd64": "amd64",
		"arm64": "arm64",
		"arm":   "armv7",
	}[arch]
	if archName == "" {
		sendStatus("error", fmt.Sprintf("Unsupported architecture: %s", arch))
		return
	}

	url := fmt.Sprintf("%s/infraview-agent-linux-%s", releaseBase, archName)
	sendStatus("downloading", fmt.Sprintf("Downloading %s binary…", archName))
	log.Info().Str("url", url).Msg("Downloading agent binary")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		sendStatus("error", fmt.Sprintf("Request failed: %v", err))
		return
	}
	httpResp, err := http.DefaultClient.Do(req)
	if err != nil {
		sendStatus("error", fmt.Sprintf("Download failed: %v", err))
		return
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode != http.StatusOK {
		sendStatus("error", fmt.Sprintf("Download returned HTTP %d", httpResp.StatusCode))
		return
	}

	tmpPath := nativeBinary + ".new"
	f, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
	if err != nil {
		sendStatus("error", fmt.Sprintf("Cannot write temp file: %v", err))
		return
	}
	if _, err := io.Copy(f, httpResp.Body); err != nil {
		f.Close()
		os.Remove(tmpPath)
		sendStatus("error", fmt.Sprintf("Write failed: %v", err))
		return
	}
	f.Close()

	if err := os.Rename(tmpPath, nativeBinary); err != nil {
		os.Remove(tmpPath)
		sendStatus("error", fmt.Sprintf("Cannot replace binary: %v", err))
		return
	}

	sendStatus("restarting", "Restarting service via systemctl…")
	log.Info().Msg("Restarting infraview-agent via systemctl")

	// Do NOT use CommandContext here: systemctl restart sends SIGTERM to this
	// process, which cancels ctx, which would kill the systemctl client before
	// it can complete — even though systemd already received the restart command.
	if err := exec.Command("systemctl", "restart", "infraview-agent").Run(); err != nil {
		sendStatus("error", fmt.Sprintf("systemctl restart failed: %v", err))
	}
}
