# Brutality — Product Requirements Document

## Problem Statement
Cross-platform (Android/iOS/Web) boxing fitness app called "Brutality" with AI-powered workout instruction, one-hand-operable UI, and an immersive dark aesthetic.

## Core Requirements
- 7 rounds × 5 min, with 3-min breaks
- AI TTS instructor calling out punch combos (1-4) and "Defense" (plank)
- ComplexityScore (0.0–1.0) governs combo depth
- IntensityScore (0.0–1.0) governs Defense frequency
- Hold Menu on long-press: Settings, Spotify, Pause, Next Round, Repeat Round
- Black background, gray metallic "B" logo, molten-orange animations
- Haptic feedback on supported devices

## Tech Stack
- **Frontend**: React Native / Expo 54, TypeScript, Reanimated 4, Gesture Handler
- **Backend**: Python FastAPI, MongoDB
- **TTS**: OpenAI TTS-1 (optional), browser Web Speech API fallback

---

## What's Been Implemented (March 2026)

### P0 — Complete
- [x] Backend API: workout sessions, move command generation, TTS endpoint, audio track management
- [x] Frontend: Home screen with "B" logo, tap-to-start, timer, round progression
- [x] Hold Menu: Long-press → Settings, Spotify, Pause, Next Round, Repeat Round
- [x] TTS: Backend endpoint + browser Web Speech API fallback when no OpenAI key
- [x] Haptic feedback with web-safe guards
- [x] `_layout.tsx` root layout with GestureHandlerRootView
- [x] Comprehensive README with local setup instructions
- [x] **Blank screen bug fixed** (gesture handlers were defined outside component scope)
- [x] **Missing `react-native-worklets` dependency fixed**

### P1 — Next Up
- [ ] Spiral logarithmic menu animation (previously attempted, reverted)
- [ ] Spotify integration for background techno-house music
- [ ] Provide OpenAI API key for high-quality TTS (currently using browser fallback)

### P2 — Future
- [ ] User authentication & workout history
- [ ] Push notification reminders
- [ ] Refactor `index.tsx` into hooks (`useWorkout`, `useTimer`)

---

## API Endpoints
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | /api/ | Working |
| POST | /api/workout/start | Working |
| GET | /api/workout/{id} | Working |
| POST | /api/workout/{id}/complete | Working |
| POST | /api/workout/move-command | Working |
| POST | /api/tts/generate | Working (empty audio without OpenAI key) |
| POST | /api/audio/upload | Working |
| GET | /api/audio/tracks | Working |

## Key Files
- `/app/frontend/app/index.tsx` — Main workout screen
- `/app/frontend/app/_layout.tsx` — Root layout
- `/app/frontend/components/HoldMenu.tsx` — Long-press menu
- `/app/frontend/services/api.ts` — API client with TTS fallback
- `/app/backend/server.py` — FastAPI server
- `/app/README.md` — Setup & install guide
