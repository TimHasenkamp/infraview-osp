#!/bin/sh
# InfraView Agent — Install Script
# Usage: curl -sSL https://github.com/timhasenkamp/infraview-osp/releases/latest/download/install-agent.sh | bash
# Or with config:
#   BACKEND_URL=wss://monitor.example.com AGENT_API_KEY=yourkey bash install-agent.sh

set -e

REPO="timhasenkamp/infraview-osp"
BINARY_NAME="infraview-agent"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/infraview"
CONFIG_FILE="$CONFIG_DIR/agent.env"
SERVICE_FILE="/etc/systemd/system/infraview-agent.service"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { printf "${GREEN}[infraview]${NC} %s\n" "$1"; }
warn()    { printf "${YELLOW}[infraview]${NC} %s\n" "$1"; }
error()   { printf "${RED}[infraview]${NC} %s\n" "$1" >&2; exit 1; }

# ── Root check ────────────────────────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || error "Please run as root (sudo bash install-agent.sh)"

# ── Detect architecture ───────────────────────────────────────────────────────
detect_arch() {
  case "$(uname -m)" in
    x86_64)  echo "linux-amd64" ;;
    aarch64) echo "linux-arm64" ;;
    armv7l)  echo "linux-armv7" ;;
    *)       error "Unsupported architecture: $(uname -m)" ;;
  esac
}

# ── Detect package manager ────────────────────────────────────────────────────
detect_pkg_manager() {
  if   command -v apt-get  >/dev/null 2>&1; then echo "apt"
  elif command -v pacman   >/dev/null 2>&1; then echo "pacman"
  elif command -v dnf      >/dev/null 2>&1; then echo "dnf"
  elif command -v yum      >/dev/null 2>&1; then echo "yum"
  elif command -v zypper   >/dev/null 2>&1; then echo "zypper"
  elif command -v apk      >/dev/null 2>&1; then echo "apk"
  else                                           echo "unknown"
  fi
}

# ── Install curl/wget if missing ──────────────────────────────────────────────
ensure_downloader() {
  if command -v curl >/dev/null 2>&1; then
    DOWNLOADER="curl"
    return
  fi
  if command -v wget >/dev/null 2>&1; then
    DOWNLOADER="wget"
    return
  fi
  warn "curl/wget not found — trying to install curl..."
  case "$(detect_pkg_manager)" in
    apt)    apt-get install -y -q curl ;;
    pacman) pacman -Sy --noconfirm curl ;;
    dnf)    dnf install -y -q curl ;;
    yum)    yum install -y -q curl ;;
    zypper) zypper install -y curl ;;
    apk)    apk add --quiet curl ;;
    *)      error "Cannot install curl. Please install it manually." ;;
  esac
  DOWNLOADER="curl"
}

download() {
  url="$1"
  dest="$2"
  if [ "$DOWNLOADER" = "curl" ]; then
    curl -fsSL "$url" -o "$dest"
  else
    wget -q "$url" -O "$dest"
  fi
}

# ── Resolve latest release version ───────────────────────────────────────────
get_latest_version() {
  if [ "$DOWNLOADER" = "curl" ]; then
    curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
      | grep '"tag_name"' | cut -d'"' -f4
  else
    wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" \
      | grep '"tag_name"' | cut -d'"' -f4
  fi
}

# ── Interactive config ────────────────────────────────────────────────────────
configure() {
  if [ -f "$CONFIG_FILE" ] && [ -z "$BACKEND_URL" ]; then
    warn "Config already exists at $CONFIG_FILE — skipping (delete to reconfigure)"
    return
  fi

  if [ -z "$BACKEND_URL" ]; then
    printf "Backend URL (e.g. wss://monitor.example.com/ws/agent): "
    read -r BACKEND_URL
  fi

  if [ -z "$AGENT_API_KEY" ]; then
    printf "Agent API Key: "
    read -r AGENT_API_KEY
  fi

  AGENT_ID="${AGENT_ID:-$(hostname)}"
  INTERVAL="${INTERVAL:-5}"

  mkdir -p "$CONFIG_DIR"
  cat > "$CONFIG_FILE" <<EOF
INFRAVIEW_BACKEND_URL=${BACKEND_URL}
INFRAVIEW_API_KEY=${AGENT_API_KEY}
INFRAVIEW_AGENT_ID=${AGENT_ID}
INFRAVIEW_INTERVAL=${INTERVAL}
EOF
  chmod 600 "$CONFIG_FILE"
  info "Config written to $CONFIG_FILE"
}

# ── systemd service ───────────────────────────────────────────────────────────
install_service() {
  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=InfraView Agent
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=$CONFIG_FILE
ExecStart=$INSTALL_DIR/$BINARY_NAME
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable infraview-agent
  systemctl restart infraview-agent
  info "systemd service installed and started"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  info "Installing InfraView Agent..."

  ensure_downloader

  ARCH=$(detect_arch)
  info "Architecture: $ARCH"
  info "Package manager: $(detect_pkg_manager)"

  VERSION="${VERSION:-$(get_latest_version)}"
  [ -n "$VERSION" ] || error "Could not determine latest release version"
  info "Version: $VERSION"

  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/infraview-agent-${ARCH}"
  info "Downloading from $DOWNLOAD_URL"

  TMP=$(mktemp)
  download "$DOWNLOAD_URL" "$TMP"
  chmod +x "$TMP"
  mv "$TMP" "$INSTALL_DIR/$BINARY_NAME"
  info "Binary installed to $INSTALL_DIR/$BINARY_NAME"

  configure

  if command -v systemctl >/dev/null 2>&1; then
    install_service
  else
    warn "systemd not found — start the agent manually:"
    warn "  $INSTALL_DIR/$BINARY_NAME"
  fi

  info "Done! Check status with: systemctl status infraview-agent"
}

main "$@"
