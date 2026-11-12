# MOBILE & PWA DEPLOYMENT GUIDE (CAPACITOR + APP STORE REVIEW)

## 1. PWA (Progressive Web App) Setup
The app is now fully configured as an installable PWA with offline caching and background service worker support.

- **Manifest**: `dist/manifest.webmanifest`
- **Service Worker**: `dist/sw.js` (managed via `vite-plugin-pwa`)
- **Web Download/Install**:
  - Chrome / Android: Users can click the "Install" button in the URL bar or select **Add to Home screen**.
  - Safari (iOS): Users tap the **Share** button and select **"Add to Home Screen"**.

---

## 2. Capacitor Android App (`android/`)
- **Package ID**: `com.truckwithease.app`
- **Location**: [`android/`](file:///home/runner/work/first-project/first-project/android/)
- **Permissions Configured**: Internet, Network State, Location (Coarse, Fine, Background for Fleet Telematics), Camera, Audio.
- **Launcher Icons**: Generated across all mipmap densities (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`).

### How to Build APK / AAB for Android:
```bash
npm run cap:sync
# To open directly in Android Studio:
npx cap open android
# Or build with Gradle:
cd android && ./gradlew assembleDebug # For testing APK
cd android && ./gradlew bundleRelease # For Google Play AAB
```

---

## 3. Capacitor iOS App (`ios/`) & Apple App Store Review Readiness
- **Bundle ID**: `com.truckwithease.app`
- **Location**: [`ios/`](file:///home/runner/work/first-project/first-project/ios/)
- **Xcode Workspace**: `ios/App/App.xcworkspace`

### Critical Apple Review Rejection Fixes Handled:
1. **Missing Usage Descriptions (Guideline 5.1.1)**:
   - `NSLocationWhenInUseUsageDescription` & `NSLocationAlwaysAndWhenInUseUsageDescription` added with logistics/clearance justification.
   - `NSCameraUsageDescription` & `NSPhotoLibraryUsageDescription` added for FMCSA DVIR vehicle inspection documentation.
   - `NSMicrophoneUsageDescription` & `NSSpeechRecognitionUsageDescription` added for hands-free dispatch and Gemini Copilot.
2. **Missing App Store 1024x1024 Icon (Guideline 2.3.8)**:
   - Configured high-resolution icon in `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`.
3. **Export Compliance Hangup (Guideline 2.1)**:
   - Added `<key>ITSAppUsesNonExemptEncryption</key><false/>` to bypass encryption declaration blocks when uploading to TestFlight / App Store Connect.
4. **Safe Area & Status Bar**:
   - `viewport-fit=cover` and CSS `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)` configured for iPhone notch and Dynamic Island.

### How to Upload to Apple App Store Connect:
1. Open the project in Xcode:
   ```bash
   npx cap open ios
   ```
2. In Xcode:
   - Select the target `App` -> **Signing & Capabilities**.
   - Select your **Apple Developer Team** to generate the provisioning profile.
   - Choose device target: **Any iOS Device (arm64)**.
   - In Xcode menu, click **Product** -> **Archive**.
   - When the Organizer window opens, click **Distribute App** -> **App Store Connect** -> **Upload**.
