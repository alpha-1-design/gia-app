#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(pwd)/server"
OUT_DIR="$ROOT_DIR/prebuilt-rootfs"
ASSET_ROOT="$(pwd)/android/app/src/main/assets"
ASSET_DIR="$ASSET_ROOT/rootfs"
PROOT_ASSET_DIR="$ASSET_ROOT/proot"
mkdir -p "$OUT_DIR" "$ASSET_DIR" "$PROOT_ASSET_DIR"

# Optionally force building images for arm64 (requires qemu/binfmt support)
PLATFORM_ARG=""
if [ "${USE_ARM64:-0}" = "1" ]; then
  PLATFORM_ARG="--platform=linux/arm64"
  echo ">>> Building rootfs with --platform=linux/arm64 (ensure QEMU/binfmt is registered on runner)"
fi

# Packages to preinstall (adjust as needed)
ALPINE_PKGS="bash curl wget python3 nodejs npm build-base git proot"
UBUNTU_PKGS="bash curl wget python3 nodejs npm build-essential git proot openjdk-17-jre-headless"

# Helper to build and export container filesystem
build_and_export() {
  local image="$1" name="$2" pkgs="$3"
  local cname="gia_rootfs_build_${name}_$$"
  echo ">>> Pulling image: $image"
  docker pull $PLATFORM_ARG "$image"

  echo ">>> Creating container $cname from $image"
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

  # Try to copy a proot binary from the container (best-effort)
  echo ">>> Attempting to copy proot binary from container (if present)"
  if docker exec "$cid" sh -c "command -v proot >/dev/null 2>&1"; then
    # docker cp requires container to be running or exist; use docker cp from container path
    set +e
    docker cp "$cid":/usr/bin/proot "$OUT_DIR/${name}-proot" 2>/dev/null || true
    docker cp "$cid":/usr/local/bin/proot "$OUT_DIR/${name}-proot" 2>/dev/null || true
    set -e
    if [ -f "$OUT_DIR/${name}-proot" ]; then
      echo ">>> Found proot in container: $OUT_DIR/${name}-proot"
      chmod +x "$OUT_DIR/${name}-proot" || true
      cp -f "$OUT_DIR/${name}-proot" "$PROOT_ASSET_DIR/proot"
      echo ">>> Copied proot to assets: $PROOT_ASSET_DIR/proot"
    else
      echo ">>> proot binary not found via docker cp; it may be in a different path or dynamically provided"
    fi
  else
    echo ">>> proot not installed in container or not found"
  fi

  echo ">>> Exporting filesystem for $name (uncompressed .tar)"
  docker export "$cid" > "$OUT_DIR/${name}-rootfs.tar"

  # Verify the tar is valid
  if tar -tf "$OUT_DIR/${name}-rootfs.tar" >/dev/null 2>&1; then
    echo ">>> Export looks valid"
    echo ">>> Moving ${name}-rootfs.tar -> assets"
    cp -f "$OUT_DIR/${name}-rootfs.tar" "$ASSET_DIR/${name}-rootfs.tar"
    echo ">>> Saved $ASSET_DIR/${name}-rootfs.tar (size: $(du -h "$ASSET_DIR/${name}-rootfs.tar" | cut -f1))"
  else
    echo ">>> ERROR: exported tar invalid for $name, skipping copy" >&2
  fi

  echo ">>> Cleaning up container $cid"
  docker rm -f "$cid" >/dev/null 2>&1 || true
}

echo ">>> Starting prebuilt rootfs creation (alpine + ubuntu only)"
build_and_export "alpine:3.21" "alpine" "$ALPINE_PKGS"
build_and_export "ubuntu:22.04" "ubuntu" "$UBUNTU_PKGS"

echo ">>> All done. Artifacts placed in: $ASSET_DIR"
ls -lh "$ASSET_DIR" || true
if [ -f "$PROOT_ASSET_DIR/proot" ]; then
  ls -lh "$PROOT_ASSET_DIR/proot" || true
fi
