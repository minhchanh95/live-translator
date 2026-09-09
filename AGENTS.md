# AGENTS.md

## Project overview

This repo is a small Next.js demo for live speech translation. The browser captures microphone input with the Web Speech API, sends the stream/session setup to the backend, and uses OpenAI Realtime plus a translation backend endpoint to produce translated text for a live event.

## Architecture

- App Router in `app/`
- Client UI and browser speech logic live in `app/page.tsx`
- Realtime session setup for OpenAI lives in `app/api/session/route.ts`
- Text translation proxy lives in `app/api/translate/route.ts`
- Keep all environment secrets on the server only; never expose `OPENAI_API_KEY` or similar values to the client

## Key conventions

- Prefer small, surgical changes that fit the existing demo architecture.
- Use TypeScript in the Next.js app and keep browser-only logic client-side.
- When updating the realtime session config, maintain the OpenAI `realtime` call flow and WebRTC SDP contract.
- When updating translation behavior, keep the request shape (`text`, `source`, `target`) compatible with the existing frontend logic.
- This is a prototype app: keep logic simple and explicit rather than introducing large abstractions.

## Environment and setup

- Install dependencies: `npm install`
- Local development: `npm run dev`
- Production build: `npm run build`
- Linting: `npm run lint`
- Required env file: `.env.local` with `OPENAI_API_KEY`; example values are in `.env.example`

## Important notes

- Browser support is best in Chrome or Edge.
- The OpenAI call expects a valid SDP offer in `/api/session`.
- The translation endpoint proxies to Google Translate and expects a valid `text` payload.
- If API quota or billing is exhausted, `insufficient_quota` errors are expected from OpenAI.

## Files to check first

- `README.md` for product behavior and setup steps
- `app/page.tsx` for transcription and translation UI logic
- `app/api/session/route.ts` for realtime session creation
- `app/api/translate/route.ts` for translation proxy behavior

## Working style for AI agents

- Link to existing docs rather than duplicating them.
- Prefer minimal edits over refactors unless the task specifically requires them.
- If a fix impacts speech recognition, realtime session setup, or translation payloads, validate the flow end-to-end in the browser and backend.
- Do not hardcode secrets or add client-side access to sensitive values.
