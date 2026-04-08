# Native iOS app

This directory now contains a native SwiftUI iPhone client for the existing Ember backend.

## Native screens in this pass

- password login and signup
- feed grid/list backed by `/api/images`
- Ember detail view backed by `/api/images/:id`
- wiki view backed by `/api/wiki/:imageId`
- native media upload backed by `/api/images`
- profile edit and logout backed by `/api/profile` and `/api/auth/logout`

## Open it in Xcode

1. On a Mac, open `ios/Ember.xcodeproj`.
2. Edit `ios/Configurations/Debug.xcconfig` and `ios/Configurations/Release.xcconfig`.
3. Set `EMBER_APP_URL` to your local, staging, or production Ember site.
4. Choose an iPhone simulator or device and run the `Ember` target.

## Notes

- `Debug.xcconfig` defaults to `http://localhost:3000` for simulator testing on the same Mac.
- `Release.xcconfig` intentionally ships with a placeholder URL. Replace it before archiving.
- `NSAllowsLocalNetworking` is enabled so simulator builds can talk to local development hosts more easily. Production should still use HTTPS.
- The older `WKWebView` shell file is still present in the project as a fallback artifact, but the active app flow is now native-first.
- I could not compile or run this target from the current Windows environment, so this pass was checked structurally rather than with an actual Xcode build.

## Logical next screens

- phone-code and magic-link auth
- contributor management and tagging
- richer wiki markdown rendering
- native friends/network management
