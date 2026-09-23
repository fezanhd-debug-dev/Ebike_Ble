# E-Bike Smart BLE Companion App

Bluetooth Low Energy Companion App built with Capacitor & Web APIs, integrated with Nordic UART / Custom Service `0xFFF0` (Notify `0xFFF1`, Write `0xFFF2`).

## Features
- **Live Cockpit**: Speedometer, Trip distance, Range, Drive mode (Eco/City/Turbo), Ignition & Headlight toggle switches.
- **BMS & Battery Balancer**: 14S individual cell voltages, remaining charge cycles, customizable OVP/UVP/Thermal limits.
- **Anti-Theft GPS Tracker**: Geofence radius alerts, bike parking coordinates.
- **BLE Diagnostic Terminal**: Live GATT console log with manual hex payload sender.

## How to Build APK via GitHub Actions (Without Android Studio)
1. Create a repository on GitHub (e.g. `ebike-smart-companion`).
2. Add all above files matching their exact file path.
3. Commit and push to `main` branch.
4. Go to **Actions** tab in your repository and wait for **Build Android APK** workflow to finish.
5. Download **EBike-Smart-App-debug.apk** from the Artifacts section and install it on your Android phone!
