# mishirji ka bot

Expo chat app for web, Android, and iOS. Demo mode works without credentials. Switch to OpenAI in the chat screen to use live replies; switching modes starts a new conversation.

## Local setup

1. Run `npm ci` in this directory if dependencies are missing.
2. Copy `.env.example` to `.env.local`.
3. Set `OPENAI_API_KEY` to your own API key and `OPENAI_MODEL` to a Responses-compatible text model ID available to your account. Both values are server-only; never prefix the key with `EXPO_PUBLIC_`.
4. Run `npm run web` (or `npm start` for Expo on a device). Restart the server after changing environment values.
5. Switch to OpenAI and send a message. Missing configuration or service failures appear with a retry action.

Messages stay in app memory and reset on reload. Live chat sends up to the latest 39 messages to `/api/chat`, which calls OpenAI with `store: false`. Demo messages are never mixed into live conversations. Enter sends on web; Shift+Enter inserts a newline. Mobile uses the send button.

## Checks

`npx tsc --noEmit`

`node --test tests/chat-api.test.mjs` (Node 24; mocked requests, no API charges)

`npx expo export --platform web`

## Hosting

The web output is a server app, including the API route. Supply the two environment values on the server. Native production builds also need the deployed server URL set as the Expo Router plugin's `origin` in `app.json`.

This is a local development integration. Authentication and shared rate limiting are not implemented; add those before making the paid API route publicly available.

References: [OpenAI text generation](https://developers.openai.com/api/docs/guides/text), [Expo API routes](https://docs.expo.dev/router/web/api-routes/).
