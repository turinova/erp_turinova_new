#!/bin/bash
# iOS Simulator helyfelszabadítás — Terminal.app, admin jelszó kell.
set -uo pipefail

echo "Szabad hely MOST:"
df -h /System/Volumes/Data | awk 'NR==1 || /Data/'
echo ""

BUNDLE="/Library/Developer/CoreSimulator/Cryptex/Images/bundle/SimRuntimeBundle-2FEB9D5C-DEF7-467C-9C64-01FA6E7888FA"
ASSET="/System/Library/AssetsV2/com_apple_MobileAsset_iOSSimulatorRuntime/c0d3fd05106683ba0b3680d4d1afec65f098d700.asset"
ASSET_DMG="$ASSET/AssetData/044-89849-100.dmg"

echo "1) Összes Simulator / Cryptex DMG lecsatolása…"
# Nested restore dmg first, then outer bundle mount (disk6)
sudo diskutil unmount force "$BUNDLE/Restore" 2>/dev/null || true
sudo diskutil unmount force "$BUNDLE" 2>/dev/null || true
sudo diskutil unmount force /Library/Developer/CoreSimulator/Volumes/iOS_22F77 2>/dev/null || true

# Detach by image path (works even if mount point renamed)
if [ -f "$ASSET_DMG" ]; then
  sudo hdiutil detach "$ASSET_DMG" -force 2>/dev/null || true
fi
if [ -f "$BUNDLE/Restore/044-89417-100.dmg" ]; then
  sudo hdiutil detach "$BUNDLE/Restore/044-89417-100.dmg" -force 2>/dev/null || true
fi
# Fallback: any disk still mounted under CoreSimulator
mount | awk '/CoreSimulator/ {print $1}' | while read -r dev; do
  sudo diskutil unmount force "$dev" 2>/dev/null || true
  sudo hdiutil detach "$dev" -force 2>/dev/null || true
done

sleep 1
echo "Mountok CoreSimulator alatt most:"
mount | grep CoreSimulator || echo "(nincs)"

echo ""
echo "2) Cryptex bundle törlés…"
sudo rm -rf /Library/Developer/CoreSimulator/Cryptex/Images/bundle
sudo rm -rf /Library/Developer/CoreSimulator/Volumes/iOS_22F77 2>/dev/null || true

echo ""
echo "3) AssetsV2 (SIP)…"
if [ -d "$ASSET" ]; then
  if sudo rm -rf "$ASSET" 2>/tmp/sim-rm-err.txt; then
    echo "AssetsV2 törölve."
  else
    echo "SIP blokkolta. Próbáld Xcode UI-t:"
    echo "  Xcode → Settings → Platforms → iOS 18.5 → Delete"
    echo "  vagy: Rendszerbeállítások → Általános → Tárhely → Fejlesztő"
    # Ha a DMG le van csatolva, néha a MobileAsset cache ürítése segít:
    echo ""
    echo "Alternatíva (másold be, ha az Xcode UI nem látja):"
    echo "  open \"x-apple.systempreferences:com.apple.settings.Storage\""
  fi
fi

rm -rf "$HOME/Library/Developer/CoreSimulator/Devices"/* 2>/dev/null || true

echo ""
echo "Szabad hely UTÁN:"
df -h /System/Volumes/Data | awk 'NR==1 || /Data/'
echo ""
du -sh /Library/Developer/CoreSimulator \
  /System/Library/AssetsV2/com_apple_MobileAsset_iOSSimulatorRuntime 2>/dev/null || true
