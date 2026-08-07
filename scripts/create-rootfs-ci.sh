#!/usr/bin/env bash
set -euo pipefail

# create-rootfs-ci.sh
# Builds preinstalled Alpine + Ubuntu rootfs tarballs for the on-device PRoot
# terminal, then places them where the app expects them:
#
#   android/app/src/main/assets/terminal/alpine-minirootfs.tar.gz  (gzipped, preinstalled)
#   android/app/src/main/assets/terminal/ubuntu-rootfs.tar.gz      (gzipped, preinstalled)
#   android/app/src/main/assets/terminal/proot                     (best-effort arm64 proot)
#
# Defaults to linux/arm64 (Android). Set USE_ARM64=0 to build for the host
# architecture instead. Requires Docker with QEMU/binfmt registered when
# cross-building (see build-apk.yml which registers tonistiigi/binfmt).

ROOT_DIR="$(pwd)/server"
OUT_DIR="$ROOT_DIR/prebuilt-rootfs"
ASSET_DIR="$(pwd)/android/app/src/main/assets/terminal"
mkdir -p "$OUT_DIR" "$ASSET_DIR"

PLATFORM_ARG=""
if [ "${USE_ARM64:-1}" = "1" ]; then
  PLATFORM_ARG="--platform=linux/arm64"
  echo ">>> Building rootfs with --platform=linux/arm64 (Android)"
else
  echo ">>> Building rootfs for host architecture"
fi

# Packages to preinstall (adjust as needed).
# NOTE: Alpine's apk repos do NOT ship a `proot` package — proot is bundled
# separately as assets/terminal/proot (or libproot.so on Android).
ALPINE_PKGS="bash curl wget python3 nodejs npm build-base git openssh sudo vim sqlite ca-certificates jq zip unzip rsync openssl"
UBUNTU_PKGS="bash curl wget python3 python3-pip nodejs npm build-essential git proot openssh-client sudo vim ca-certificates jq zip unzip rsync openssl"

# Helper to build and export container filesystem as a gzipped rootfs tarball
build_and_export() {
  local image="$1" name="$2" pkgs="$3" outfile="$4"
  local cname="gia_rootfs_build_${name}_$$"
  local install_ok=0
  echo ">>> Pulling image: $image"
  docker pull $PLATFORM_ARG "$image"

  echo ">>> Creating container $cname from $image"
  cid=$(docker create $PLATFORM_ARG --name "$cname" "$image" /bin/sh -c "sleep 3600")
  docker start "$cid"

  echo ">>> Installing packages into $name rootfs: $pkgs"
  if [[ "$image" == alpine* ]]; then
    docker exec "$cid" sh -c "apk update && apk add --no-cache $pkgs" && install_ok=1 || echo ">>> WARNING: apk install failed for $name (partial/empty rootfs)"
    docker exec "$cid" sh -c "mkdir -p /root /workspace && printf 'nameserver 8.8.8.8\nnameserver 1.1.1.1\n' > /etc/resolv.conf" || true
  else
    # Debian / Ubuntu
    docker exec "$cid" sh -c "apt-get update" || true
    docker exec "$cid" sh -c "DEBIAN_FRONTEND=noninteractive apt-get install -y $pkgs" && install_ok=1 || echo ">>> WARNING: apt install failed for $name (partial/empty rootfs)"
    docker exec "$cid" sh -c "apt-get clean" || true
    docker exec "$cid" sh -c "mkdir -p /root /workspace && printf 'nameserver 8.8.8.8\nnameserver 1.1.1.1\n' > /etc/resolv.conf" || true
  fi

  if [ "$install_ok" != "1" ]; then
    echo ">>> ERROR: package install failed for $name — keeping existing asset, not overwriting" >&2
    docker rm -f "$cid" >/dev/null 2>&1 || true
    return 1
  fi

  echo ">>> Exporting filesystem for $name"
  docker export "$cid" | gzip -1 > "$OUT_DIR/${name}-rootfs.tar.gz"

  # Verify the gzip is valid
  if gzip -t "$OUT_DIR/${name}-rootfs.tar.gz" 2>/dev/null; then
    echo ">>> Export looks valid (gzip ok)"
    cp -f "$OUT_DIR/${name}-rootfs.tar.gz" "$ASSET_DIR/$outfile"
    echo ">>> Saved $ASSET_DIR/$outfile (size: $(du -h "$ASSET_DIR/$outfile" | cut -f1))"
  else
    echo ">>> ERROR: exported tarball invalid for $name, skipping copy" >&2
    docker rm -f "$cid" >/dev/null 2>&1 || true
    return 1
  fi

  # Try to copy a proot binary from the container (best-effort)
  if [[ "$name" == "alpine" ]]; then
    echo ">>> Attempting to copy proot binary from container (if present)"
    if docker exec "$cid" sh -c "command -v proot >/dev/null 2>&1"; then
      set +e
      docker cp "$cid":/usr/bin/proot "$ASSET_DIR/proot" 2>/dev/null || true
      docker cp "$cid":/usr/local/bin/proot "$ASSET_DIR/proot" 2>/dev/null || true
      set -e
      if [ -f "$ASSET_DIR/proot" ] && [ -s "$ASSET_DIR/proot" ]; then
        chmod +x "$ASSET_DIR/proot" || true
        echo ">>> Copied proot to $ASSET_DIR/proot"
      else
        rm -f "$ASSET_DIR/proot"
        echo ">>> proot binary not found in container; keeping existing asset"
      fi
    fi
  fi

  echo ">>> Cleaning up container $cid"
  docker rm -f "$cid" >/dev/null 2>&1 || true
}

echo ">>> Starting prebuilt rootfs creation (alpine + ubuntu)"
# Each build is independent — a failure in one must not abort the other.
set +e
build_and_export "alpine:3.21" "alpine" "$ALPINE_PKGS" "alpine-minirootfs.tar.gz"
build_and_export "ubuntu:22.04" "ubuntu" "$UBUNTU_PKGS" "ubuntu-rootfs.tar.gz"
set -e

echo ">>> All done. Artifacts placed in: $ASSET_DIR"
ls -lh "$ASSET_DIR" || true

# Hard-fail only if NO rootfs asset is available at all (terminal would be broken).
if [ ! -f "$ASSET_DIR/alpine-minirootfs.tar.gz" ] && [ ! -f "$ASSET_DIR/ubuntu-rootfs.tar.gz" ]; then
  echo ">>> ERROR: no rootfs asset produced (alpine + ubuntu both failed) and none pre-existed" >&2
  exit 1
fi
exit 0
