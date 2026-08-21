#!/bin/sh
# GIA Device Smoke Test
# Run this in the terminal module to validate on-device functionality.
# Usage: sh scripts/device-smoke-test.sh
# Or paste into GIA terminal: run the commands below one by one.

set -e

echo "═══════════════════════════════════════════"
echo "  GIA Device Smoke Test"
echo "═══════════════════════════════════════════"
echo ""

PASS=0
FAIL=0
WARN=0

check() {
  DESC="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    echo "  ✅ $DESC"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $DESC"
    FAIL=$((FAIL + 1))
  fi
}

check_warn() {
  DESC="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    echo "  ✅ $DESC"
    PASS=$((PASS + 1))
  else
    echo "  ⚠️  $DESC (non-critical)"
    WARN=$((WARN + 1))
  fi
}

echo "── Shell & Core ──"
check "sh exists and runs" sh -c "true"
check "busybox exists" test -f /bin/busybox
check "/bin/sh symlink works" test -x /bin/sh
check "/usr/bin/env exists" test -f /usr/bin/env

echo ""
echo "── DNS & Network ──"
check "resolv.conf exists" test -f /etc/resolv.conf
check_warn "DNS resolves (google.com)" nslookup google.com

echo ""
echo "── Package Manager ──"
check "apk available" apk --version
check_warn "apk update works" apk update

echo ""
echo "── Development Tools ──"
check_warn "node installed" node --version
check_warn "npm installed" npm --version
check_warn "git installed" git --version
check_warn "python3 installed" python3 --version
check_warn "gcc installed" gcc --version
check_warn "curl installed" curl --version
check_warn "wget installed" wget --version
check_warn "bash installed" bash --version

echo ""
echo "── File System ──"
check "can write to /tmp" sh -c "echo test > /tmp/gia-smoke-test && rm /tmp/gia-smoke-test"
check "can create directories" mkdir -p /tmp/gia-test-dir && rmdir /tmp/gia-test-dir

echo ""
echo "── Process Execution ──"
check "can run subprocess" sh -c "echo hello | grep hello"
check "can run background process" sh -c "sleep 0.1 & wait"

echo ""
echo "═══════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed, $WARN warnings"
echo "═══════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo "  ❗ Some critical checks failed."
  echo "  Run 'Set Up Environment' in Settings → Terminal to repair."
  exit 1
else
  echo "  ✅ All critical checks passed."
  exit 0
fi
