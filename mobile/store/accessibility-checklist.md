# Ember Accessibility Checklist

Last updated: March 21, 2026

Ember for iPhone is a WebView shell around the Ember web experience, so accessibility labels should only be claimed after testing the actual web flows inside the app.

## Safe position today

- Dark Interface: `Do not claim`
  - The current shell is intentionally light.
- Captions: `Do not claim`
  - The app doesn’t currently guarantee captions for all uploaded videos.
- Audio Descriptions: `Do not claim`
  - No app-wide audio-description feature is implemented.

## Likely support, but verify before claiming

- VoiceOver
  - Test sign in, feed, upload, memory detail, Story Circle, and profile.
- Voice Control
  - Test buttons, links, form fields, and modal actions.
- Larger Text
  - Verify the hosted web UI remains usable with larger text settings.
- Differentiate Without Color Alone
  - Verify status and error states are still clear without color.
- Sufficient Contrast
  - Audit orange-on-white and muted text combinations.
- Reduced Motion
  - The web app currently includes a `prefers-reduced-motion` fallback, but verify major flows inside the iPhone shell.

## Manual test pass before App Store Connect

1. Turn on VoiceOver and complete sign up or sign in.
2. Upload one image and verify focus order through the upload flow.
3. Open one memory and navigate to wiki/chat/story screens.
4. Trigger an error state and confirm the message is announced clearly.
5. Increase system text size and confirm core screens remain usable.
6. Enable Reduce Motion and confirm animated screens settle correctly.

## Recommendation

Until you finish the pass above, leave Accessibility Nutrition Labels conservative rather than overstating support.
