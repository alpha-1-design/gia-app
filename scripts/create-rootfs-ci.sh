#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(pwd)/server"
OUT_DIR="$ROOT_DIR/prebuilt-rootfs"
ASSET_DIR="$(pwd)/android/app/src/main/assets/rootfs"
mkdir -p "$OUT_DIR" "$ASSET_DIR"

# Optionally force building images for arm64 (requires qemu/binfmt support)
PLATFORM_ARG=""
if [ "${USE_ARM64:-0}" = "1" ]; then
  PLATFORM_ARG="--platform=linux/arm64"
  echo ">>> Building rootfs with --platform=linux/arm64 (ensure QEMU/binfmt is registered on runner)"
fi

# Packages to preinstall (adjust as needed)
ALPINE_PKGS="bash curl wget python3 nodejs npm build-base proot"
DEBIAN_PKGS="bash curl wget python3 nodejs npm build-essential proot"
UBUNTU_PKGS="$DEBIAN_PKGS"

# Helper to build and export container filesystem
build_and_export() {
  local image="$1" name="$2" pkgs="$3"
  local cname="gia_rootfs_build_${name}_$$"
  echo ">>> Pulling image: $image"
  docker pull $PLATFORM_ARG "$image"

  echo ">>> Creating container $cname from $image"
  # Create (but don't run) a container so we can exec install then export
  cid=$(docker create $PLATFORM_ARG --name "$cname" "$image" /bin/sh -c "sleep 300")
  docker start "$cid"

  echo ">>> Installing packages into $name rootfs: $pkgs"
  if [[ "$image" == alpine* ]]; then
    docker exec "$cid" sh -c "apk update && apk add --no-cache $pkgs || true"
  else
    # Debian / Ubuntu
    docker exec "$cid" sh -c "apt-get update || true"
    docker exec "$cid" sh -c "DEBIAN_FRONTEND=noninteractive apt-get install -y $pkgs || true"
    docker exec "$cid" sh -c "apt-get clean || true"
  fi

  echo ">>> Exporting filesystem for $name"
  docker export "$cid" | gzip -c > "$OUT_DIR/${name}-rootfs.tar.gz"

  echo ">>> Cleaning up container $cid"
  docker rm -f "$cid" >/dev/null 2>&1 || true

  echo ">>> Moving ${name}-rootfs.tar.gz -> assets"
  cp -f "$OUT_DIR/${name}-rootfs.tar.gz" "$ASSET_DIR/"
  echo ">>> Saved $ASSET_DIR/${name}-rootfs.tar.gz (size: $(du -h "$ASSET_DIR/${name}-rootfs.tar.gz" | cut -f1))"
}

echo ">>> Starting prebuilt rootfs creation"
build_and_export "alpine:3.21" "alpine" "$ALPINE_PKGS"
build_and_export "debian:12-slim" "debian" "$DEBIAN_PKGS"
build_and_export "ubuntu:22.04" "ubuntu" "$UBUNTU_PKGS"

echo ">>> All done. Artifacts placed in: $ASSET_DIR"
ls -lh "$ASSET_DIR" || true
