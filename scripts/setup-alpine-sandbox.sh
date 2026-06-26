#!/usr/bin/env bash
set -euo pipefail

# setup-alpine-sandbox.sh
# Downloads Alpine Linux rootfs and sets up PRoot execution environment for GIA.
#
# Usage: ./scripts/setup-alpine-sandbox.sh [--arch aarch64|armhf|x86_64] [--dir ./server/alpine-rootfs]
#
# Defaults: alpine 3.21, x86_64 (matches dev machine), server/alpine-rootfs/
# On Android (arm64), pass --arch aarch64

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

ALPINE_VERSION="3.21"
ARCH="x86_64"
ROOTFS_DIR="${REPO_DIR}/server/alpine-rootfs"
WORKSPACE_DIR="${REPO_DIR}/server/sandbox-workspace"
PRoot_BIN="${REPO_DIR}/server/proot"

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --arch) ARCH="$2"; shift 2 ;;
    --dir) ROOTFS_DIR="$2"; shift 2 ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

# Map arch to Alpine tarball naming
case "$ARCH" in
  x86_64)   ALPINE_ARCH="x86_64" ;;
  aarch64)  ALPINE_ARCH="aarch64" ;;
  armhf)    ALPINE_ARCH="armhf" ;;
  armv7)    ALPINE_ARCH="armv7" ;;
  i386|x86) ALPINE_ARCH="x86" ;;
  riscv64)  ALPINE_ARCH="riscv64" ;;
  *) echo "Unsupported arch: $ARCH"; exit 1 ;;
esac

ROOTFS_URL="https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/${ALPINE_ARCH}/alpine-minirootfs-${ALPINE_VERSION}.0-${ALPINE_ARCH}.tar.gz"
ROOTFS_FILE="${ROOTFS_DIR}/alpine-minirootfs.tar.gz"

echo "=== GIA Alpine Sandbox Setup ==="
echo "  Alpine:  v${ALPINE_VERSION} (${ALPINE_ARCH})"
echo "  Rootfs:  ${ROOTFS_DIR}"
echo "  Workspace: ${WORKSPACE_DIR}"
echo ""

# Create directories
mkdir -p "$ROOTFS_DIR" "$WORKSPACE_DIR"

# Download rootfs if not present
if [ -f "$ROOTFS_FILE" ]; then
  echo "[✓] Rootfs tarball already exists: $ROOTFS_FILE"
else
  echo "[~] Downloading Alpine rootfs from:"
  echo "    $ROOTFS_URL"
  if command -v curl &>/dev/null; then
    curl -L -o "$ROOTFS_FILE" "$ROOTFS_URL"
  elif command -v wget &>/dev/null; then
    wget -O "$ROOTFS_FILE" "$ROOTFS_URL"
  else
    echo "Need curl or wget" >&2
    exit 1
  fi
  echo "[✓] Downloaded: $(du -h "$ROOTFS_FILE" | cut -f1)"
fi

# Extract rootfs if not already extracted
if [ -f "${ROOTFS_DIR}/etc/alpine-release" ]; then
  echo "[✓] Rootfs already extracted"
else
  echo "[~] Extracting rootfs..."
  tar -xzf "$ROOTFS_FILE" -C "$ROOTFS_DIR"
  echo "[✓] Extracted"
fi

# Verify essential structure
echo "[~] Verifying rootfs..."
for dir in bin etc lib usr var; do
  if [ ! -d "${ROOTFS_DIR}/${dir}" ]; then
    echo "Missing ${dir} in rootfs" >&2
    exit 1
  fi
done
echo "[✓] Rootfs structure verified"

# Check for PRoot
PRoot_CMD=""
if command -v proot &>/dev/null; then
  PRoot_CMD="proot"
  echo "[✓] PRoot found at $(which proot)"
elif [ -x "$PRoot_BIN" ]; then
  PRoot_CMD="$PRoot_BIN"
  echo "[✓] Bundled PRoot found at $PRoot_BIN"
else
  echo "[!] PRoot not found. Commands will use chroot (requires root/sudo)."
  echo "    Install PRoot: pkg install proot  (or brew install proot)"
  echo "    Or download static binary and place at: $PRoot_BIN"
fi

# Set up resolv.conf for network access in sandbox
if [ ! -f "${ROOTFS_DIR}/etc/resolv.conf" ]; then
  echo "nameserver 8.8.8.8" > "${ROOTFS_DIR}/etc/resolv.conf"
  echo "nameserver 1.1.1.1" >> "${ROOTFS_DIR}/etc/resolv.conf"
  echo "[✓] Created resolv.conf"
fi

# Create workspace mount point inside rootfs
mkdir -p "${ROOTFS_DIR}/workspace"

# Install base packages inside sandbox
echo ""
echo "=== Installing Packages ==="
INSTALL_CMD="apk update && apk add python3 py3-pip nodejs npm git bash curl wget openssh sudo vim build-base gcc g++ make sqlite ca-certificates jq yq-go ripgrep fd tree zip unzip rsync aria2 openssl ffmpeg redis go perl pipx httpie iptables ip6tables whois nmap nmap-scripts lsof tcpdump bind-tools ethtool net-tools kmod strace"

SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

if [ -n "$PRoot_CMD" ]; then
  echo "[~] Installing packages via apk (may take a while)..."
  SSL_CERT_FILE="${SSL_CERT_FILE}" $PRoot_CMD -r "$ROOTFS_DIR" sh -c "$INSTALL_CMD" 2>&1 | tail -5
  echo "[✓] Packages installed"
  echo "[~] Installing Python packages..."
  SSL_CERT_FILE="${SSL_CERT_FILE}" $PRoot_CMD -r "$ROOTFS_DIR" sh -c "pip3 install --break-system-packages requests aiohttp httpx beautifulsoup4 lxml pillow numpy pandas matplotlib pyyaml" 2>&1 | tail -3
  echo "[✓] Python packages installed"
else
  echo "[!] Skipping package install (no PRoot available)"
fi

echo ""
echo "=== Sandbox Ready ==="
echo "  Rootfs:  ${ROOTFS_DIR}"
echo "  Workspace: ${WORKSPACE_DIR}"
echo "  Packages: 276+ (languages, dev tools, utilities)"
echo ""

# Quick test
echo "[~] Testing sandbox execution..."
TEST_CMD="echo 'Alpine $(cat ${ROOTFS_DIR}/etc/alpine-release 2>/dev/null || echo '?') sandbox ready'"

if [ -n "$PRoot_CMD" ]; then
  SSL_CERT_FILE="${SSL_CERT_FILE}" $PRoot_CMD -r "$ROOTFS_DIR" -b "$WORKSPACE_DIR:/workspace" -w /workspace sh -c "$TEST_CMD"
else
  sudo chroot "$ROOTFS_DIR" sh -c "$TEST_CMD"
fi

echo ""
echo "=== Setup Complete ==="
echo "Start the sandbox server:  node server/sandbox-server.cjs --proot"
echo "Or run directly:           node server/sandbox-server.cjs --proot --rootfs ${ROOTFS_DIR} --workspace ${WORKSPACE_DIR}"
