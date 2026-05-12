#!/bin/bash
# Run this in Termux after cloning the repo
# Usage: cd gia-app && bash setup-android.sh

set -e

echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

echo "🔨 Building web assets..."
npm run build

echo "📱 Adding Android platform..."
if [ ! -d "android" ]; then
  npx cap add android
fi

echo "🔄 Syncing Capacitor..."
npx cap sync android

echo "📋 Patching AndroidManifest.xml..."
MANIFEST="android/app/src/main/AndroidManifest.xml"

python3 - << 'PYEOF'
import re

path = "android/app/src/main/AndroidManifest.xml"
with open(path) as f:
    content = f.read()

permissions = """
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
"""

if "android.permission.INTERNET" not in content:
    content = content.replace(
        "<application",
        permissions + "\n    <application",
        1
    )

# Add TTS query
if "<queries>" not in content:
    queries = """
    <queries>
        <intent>
            <action android:name="android.intent.action.TTS_SERVICE" />
        </intent>
    </queries>
"""
    content = content.replace("</manifest>", queries + "\n</manifest>")

# Enable cleartext traffic
if "usesCleartextTraffic" not in content:
    content = content.replace(
        'android:theme="@style/AppTheme"',
        'android:theme="@style/AppTheme"\n        android:usesCleartextTraffic="true"'
    )

with open(path, "w") as f:
    f.write(content)

print("✅ AndroidManifest.xml patched")
PYEOF

echo ""
echo "✅ Setup complete!"
echo ""
echo "To build the APK, open the project in Android Studio"
echo "or push to GitHub to trigger the Actions workflow."
echo ""
echo "In Android Studio: Build → Build Bundle(s)/APK(s) → Build APK(s)"
