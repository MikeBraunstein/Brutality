# Brutality - AI-Powered Boxing Fitness App

A cross-platform (Android/iOS/Web) boxing fitness application with AI-guided workout sessions, text-to-speech instructor callouts, and an immersive dark UI.

---

## Architecture

```
brutality/
├── backend/            # Python FastAPI server
│   ├── server.py       # API endpoints & workout engine
│   ├── requirements.txt
│   └── .env            # Backend environment variables
├── frontend/           # React Native / Expo app
│   ├── app/
│   │   ├── _layout.tsx # Root layout (Gesture + SafeArea providers)
│   │   └── index.tsx   # Main workout screen
│   ├── components/
│   │   └── HoldMenu.tsx # Long-press radial menu
│   ├── services/
│   │   └── api.ts      # API client with browser TTS fallback
│   └── package.json
└── README.md
```

## Prerequisites

| Tool       | Version  | Install                                      |
|------------|----------|----------------------------------------------|
| Node.js    | >= 18    | https://nodejs.org                           |
| Yarn       | >= 1.22  | `npm install -g yarn`                        |
| Python     | >= 3.11  | https://python.org                           |
| MongoDB    | >= 6.0   | https://www.mongodb.com/docs/manual/installation/ |
| Expo CLI   | latest   | `npm install -g expo-cli` (optional, Expo is in `node_modules`) |

---

## Quick Start

### 1. Clone & install dependencies

```bash
git clone <repo-url> brutality && cd brutality

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../frontend
yarn install
```

### 2. Configure environment variables

**Backend** (`backend/.env`):
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=brutality_db
```

> **Optional – OpenAI TTS**: To enable high-quality AI speech instead of browser
> speech synthesis, add your OpenAI API key:
> ```env
> OPENAI_API_KEY=sk-your-key-here
> ```

**Frontend** (`frontend/.env`):
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

### 3. Start MongoDB

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Docker
docker run -d -p 27017:27017 --name brutality-mongo mongo:7
```

### 4. Run the backend

```bash
cd backend
source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The API will be available at **http://localhost:8001/api/**

### 5. Run the frontend

```bash
cd frontend

# Web
yarn expo start --web

# iOS Simulator
yarn expo start --ios

# Android Emulator
yarn expo start --android

# Physical device (scan QR code)
yarn expo start
```

---

## API Endpoints

| Method | Endpoint                     | Description                       |
|--------|------------------------------|-----------------------------------|
| GET    | `/api/`                      | Health check                      |
| POST   | `/api/workout/start`         | Start a new workout session       |
| GET    | `/api/workout/{session_id}`  | Get workout session details       |
| POST   | `/api/workout/{session_id}/complete` | Complete a workout session |
| POST   | `/api/workout/move-command`  | Generate a punch/defense command  |
| POST   | `/api/tts/generate`          | Generate text-to-speech audio     |
| POST   | `/api/audio/upload`          | Upload background music track     |
| GET    | `/api/audio/tracks`          | List available audio tracks       |

### Example: Start a workout

```bash
curl -X POST http://localhost:8001/api/workout/start \
  -H "Content-Type: application/json" \
  -d '{"user_id": "player_1"}'
```

### Example: Generate a move command

```bash
curl -X POST "http://localhost:8001/api/workout/move-command?complexity=0.5&intensity=0.7&round_number=3"
```

---

## Workout Structure

- **7 rounds**, 5 minutes each
- **3-minute rest** between rounds
- **ComplexityScore** (0.0–1.0): Governs combo difficulty — starts with single-number calls, progresses to broken combos
- **IntensityScore** (0.0–1.0): Governs frequency of "Defense" (plank) commands
- Punch callouts: `1` = Left straight, `2` = Right straight, `3` = Left hook, `4` = Right uppercut

---

## Features

### Implemented
- Black UI with metallic "B" logo and molten-orange tap animation
- Full workout timer (round progression, break detection)
- AI-generated move commands with complexity/intensity scaling
- **Hold Menu**: Long-press the logo (1 sec) to access:
  - Settings
  - Spotify connection (placeholder)
  - Pause/Resume workout
  - Advance to next round
  - Repeat current round
- **TTS Instructor**: Uses OpenAI TTS when an API key is provided, otherwise falls back to the browser's built-in Web Speech API
- Haptic feedback on supported devices

### Planned
- Spiral logarithmic menu animation
- Spotify integration for background techno-house music
- User authentication & workout history
- Push notification reminders

---

## Building for Production

### Static Web Build

```bash
cd frontend
yarn expo export --platform web
# Output → frontend/dist/
# Serve with any static file server (nginx, serve, etc.)
npx serve dist
```

### Native Builds (EAS)

```bash
# Install EAS CLI
npm install -g eas-cli

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Cannot find module 'react-native-worklets/plugin'` | Run `yarn add react-native-worklets@0.5.1` |
| Metro bundler shows blank page | Clear cache: `yarn expo start --clear` |
| Backend won't start (KeyError: 'DB_NAME') | Ensure `backend/.env` has `DB_NAME=brutality_db` on its own line |
| Haptics crash on web | Already handled — haptic calls are wrapped with platform checks |
| TTS returns empty audio | Add `OPENAI_API_KEY` to `backend/.env`, or the app uses browser speech synthesis as fallback |

---

## License

MIT
