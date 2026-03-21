# Ember App Privacy Draft

Last updated: March 21, 2026

This draft is based on the current codebase, including the mobile shell, Prisma schema, and API routes. Recheck it if you add analytics, ads, or new SDKs before submission.

## Tracking

- Tracking across third-party apps/websites: `No`
- Third-party advertising SDKs in the current iPhone shell: `None found`

## Data likely collected and linked to the user

- Contact Info
  - Name
  - Email address
  - Phone number
- User Content
  - Photos
  - Videos
  - Memory titles and descriptions
  - Chat messages and written memory responses
  - Voice transcripts and call summaries
  - Contributor names, emails, and phone numbers entered by the user
- Location
  - Photo metadata location, if embedded in an uploaded image
- Identifiers
  - App account ID / contributor token / session records used for account and archive access

## Primary purposes

- App Functionality
  - Account creation and sign-in
  - Uploading and organizing memories
  - Inviting contributors
  - Generating wiki pages, kids stories, and chat outputs
  - Running voice interview flows
- Personalization
  - Tailoring generated memory outputs to the uploaded content and prior responses

## Data not found in the current mobile shell

- No ad tracking SDKs
- No purchase history
- No health data
- No contacts permission access
- No precise device GPS collection from the phone itself

## Third-party processors visible in the codebase

- AI processing: OpenAI and Anthropic SDKs
- Voice / telephony: Retell and Twilio
- Email delivery: Nodemailer-backed provider configured by deployment

## Conservative App Privacy label recommendation

Use `Data Linked to You` for:

- Contact Info
- User Content
- Location
- Identifiers

Do not claim any optional analytics or tracking categories unless you add those systems later.
