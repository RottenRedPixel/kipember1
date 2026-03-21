# Ember iPhone Shell

This `mobile/` app is a thin native iPhone shell for the existing Ember website. It keeps the current Next.js backend, auth, uploads, and API routes intact, while giving you an iOS container with native safe areas, WebView behavior, and iPhone permission prompts.

## How it works

- The app loads a single configured Ember URL in `react-native-webview`.
- Same-origin navigation stays inside the app.
- External links open in Safari.
- iPhone users get pull-to-refresh, inline media playback, and swipe back/forward gestures.

## Configure the site URL

Create `mobile/.env` and set:

```bash
EXPO_PUBLIC_EMBER_APP_URL=https://your-ember-domain.com
```

Notes:

- For production, use your deployed HTTPS domain.
- For the iOS simulator on the same Mac as the web app, `http://localhost:3000` is fine.
- For a physical iPhone on your local network, use your computer's LAN URL, such as `http://192.168.x.x:3000`.

For cloud builds, also update the URLs in `mobile/eas.json`:

- `development`: local network URL for dev-client testing
- `preview`: your staging HTTPS site
- `production`: your live HTTPS site

## Run locally

```bash
cd mobile
npm install
npm run ios
```

If you are testing on a physical iPhone without a local iOS build, you can also run:

```bash
npx expo start
```

Then open the project in Expo Go.

## Build for iPhone

1. Install EAS CLI if needed: `npm install -g eas-cli`
2. Log in: `eas login`
3. Create the app record in App Store Connect.
4. Confirm the bundle ID in `mobile/app.json` is yours: `com.cbarr.ember`
5. From `mobile/`, run a TestFlight build: `npm run build:ios:production`

To submit to App Store Connect later:

```bash
npm run submit:ios
```

## First files to change

- `mobile/.env`: app target URL
- `mobile/eas.json`: build profile URLs for development, staging, and production
- `mobile/app.json`: app name, bundle metadata, permissions
- `mobile/src/app/index.tsx`: shell behavior and loading/error UI
- `mobile/store/`: App Store metadata, privacy notes, accessibility notes, and screenshot plan

## First TestFlight checklist

1. Replace the placeholder production URL in `mobile/eas.json`.
2. Change the bundle identifier in `mobile/app.json` if `com.cbarr.ember` is not the one you want to own in Apple Developer.
3. Replace any remaining placeholder Android adaptive icons if you plan to ship Android later.
4. Run `npx eas login`.
5. Run `npx eas build --platform ios --profile production`.
6. After the build succeeds, run `npx eas submit --platform ios --profile production` or upload the build manually in App Store Connect.

## Submission kit

The App Store prep notes live in `mobile/store/`:

- `metadata.md`: paste-ready store copy, categories, URLs, and release notes
- `privacy-answers.md`: App Privacy label draft based on the current codebase
- `accessibility-checklist.md`: what to verify before setting Accessibility Nutrition Labels
- `screenshot-plan.md`: current Apple iPhone screenshot sizes and a shot list
- `review-notes-template.md`: reviewer-facing notes for TestFlight/App Review
- `branding-checklist.md`: which remaining icon/splash assets still need final art
