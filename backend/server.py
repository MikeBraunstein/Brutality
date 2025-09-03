from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import base64
import httpx
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Brutality Fitness API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Emergent LLM Key for OpenAI TTS
EMERGENT_LLM_KEY = "sk-emergent-808612d9894D45735C"

# Models
class WorkoutSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    rounds_completed: int = 0
    total_rounds: int = 7
    complexity_progression: List[float] = []
    intensity_progression: List[float] = []

class WorkoutSessionCreate(BaseModel):
    user_id: str

class TTSRequest(BaseModel):
    text: str
    voice: str = "alloy"  # OpenAI TTS voices: alloy, echo, fable, onyx, nova, shimmer
    speed: float = 1.0

class TTSResponse(BaseModel):
    audio_base64: str
    text: str
    voice: str

class MoveCommand(BaseModel):
    command: str
    complexity_score: float
    intensity_score: float
    duration_ms: int
    round_number: int

class AudioTrack(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    artist: str
    audio_base64: str
    duration_ms: int
    genre: str = "techno_house"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AudioTrackCreate(BaseModel):
    name: str
    artist: str
    audio_base64: str
    duration_ms: int

# Workout Logic
class WorkoutEngine:
    def __init__(self):
        self.moves = {
            1: "Left straight punch",
            2: "Right straight punch", 
            3: "Left hook",
            4: "Right uppercut"
        }
    
    def generate_move_command(self, complexity: float, intensity: float, round_num: int) -> MoveCommand:
        """Generate a move command based on complexity and intensity scores"""
        import random
        
        command = ""
        duration_ms = 0
        
        if complexity == 0.0:
            # Single number call
            move_number = random.randint(1, 4)
            command = str(move_number)
            duration_ms = move_number * 1000 + 1500  # Each move = 1 second + 1.5 second pause
            
        elif complexity <= 0.4:
            # Defense + move combinations
            if random.random() < intensity:
                move_number = random.randint(1, 4)
                command = f"Defense and {move_number}"
                duration_ms = 1500 + (move_number * 1000) + 1500  # Defense + moves + pause
            else:
                move_number = random.randint(1, 4)
                command = str(move_number)
                duration_ms = move_number * 1000 + 1500
                
        else:
            # Complex combinations and broken combos
            if random.random() < 0.5:
                # Broken combo (call individual moves instead of numbers)
                moves = ["Left straight", "Right straight", "Left hook", "Right uppercut"]
                combo = []
                num_moves = random.randint(2, 4)
                
                if random.random() < intensity:
                    combo.append("Defense")
                
                for _ in range(num_moves):
                    combo.append(random.choice(moves))
                
                command = ", ".join(combo)
                duration_ms = len(combo) * 1500  # 1.5 seconds per move
            else:
                # Regular combination
                move_number = random.randint(1, 4)
                if random.random() < intensity:
                    command = f"Defense and {move_number}"
                    duration_ms = 1500 + (move_number * 1000) + 1500
                else:
                    command = str(move_number)
                    duration_ms = move_number * 1000 + 1500
        
        return MoveCommand(
            command=command,
            complexity_score=complexity,
            intensity_score=intensity,
            duration_ms=duration_ms,
            round_number=round_num
        )

workout_engine = WorkoutEngine()

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Brutality Fitness API - Ready to train!"}

@api_router.post("/workout/start", response_model=WorkoutSession)
async def start_workout(session_data: WorkoutSessionCreate):
    """Start a new workout session"""
    try:
        session = WorkoutSession(**session_data.dict())
        session_dict = session.dict()
        await db.workout_sessions.insert_one(session_dict)
        return session
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting workout: {str(e)}")

@api_router.get("/workout/{session_id}", response_model=WorkoutSession)
async def get_workout_session(session_id: str):
    """Get workout session details"""
    try:
        session = await db.workout_sessions.find_one({"id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Workout session not found")
        return WorkoutSession(**session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching workout: {str(e)}")

@api_router.post("/workout/{session_id}/complete")
async def complete_workout(session_id: str):
    """Mark workout session as complete"""
    try:
        result = await db.workout_sessions.update_one(
            {"id": session_id},
            {"$set": {"end_time": datetime.utcnow()}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Workout session not found")
        return {"message": "Workout completed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error completing workout: {str(e)}")

@api_router.post("/workout/move-command", response_model=MoveCommand)
async def generate_move_command(
    complexity: float = 0.0,
    intensity: float = 0.0,
    round_number: int = 1
):
    """Generate a move command based on workout parameters"""
    try:
        command = workout_engine.generate_move_command(complexity, intensity, round_number)
        return command
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating move: {str(e)}")

@api_router.post("/tts/generate", response_model=TTSResponse)
async def generate_speech(request: TTSRequest):
    """Generate text-to-speech audio using OpenAI TTS"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/audio/speech",
                headers={
                    "Authorization": f"Bearer {EMERGENT_LLM_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "tts-1",
                    "input": request.text,
                    "voice": request.voice,
                    "speed": request.speed,
                    "response_format": "mp3"
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"OpenAI API error: {response.text}"
                )
            
            # Convert audio to base64
            audio_data = response.content
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            # Save TTS request to database
            tts_record = {
                "id": str(uuid.uuid4()),
                "text": request.text,
                "voice": request.voice,
                "speed": request.speed,
                "audio_base64": audio_base64,
                "created_at": datetime.utcnow()
            }
            await db.tts_requests.insert_one(tts_record)
            
            return TTSResponse(
                audio_base64=audio_base64,
                text=request.text,
                voice=request.voice
            )
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="TTS request timed out")
    except Exception as e:
        logging.error(f"TTS error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating speech: {str(e)}")

@api_router.post("/audio/upload", response_model=AudioTrack)
async def upload_audio_track(track_data: AudioTrackCreate):
    """Upload a new audio track for workouts"""
    try:
        track = AudioTrack(**track_data.dict())
        track_dict = track.dict()
        await db.audio_tracks.insert_one(track_dict)
        return track
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading track: {str(e)}")

@api_router.get("/audio/tracks", response_model=List[AudioTrack])
async def get_audio_tracks(genre: Optional[str] = None):
    """Get available audio tracks"""
    try:
        query = {}
        if genre:
            query["genre"] = genre
            
        tracks = await db.audio_tracks.find(query).to_list(100)
        return [AudioTrack(**track) for track in tracks]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching tracks: {str(e)}")

@api_router.get("/audio/track/{track_id}", response_model=AudioTrack)
async def get_audio_track(track_id: str):
    """Get specific audio track"""
    try:
        track = await db.audio_tracks.find_one({"id": track_id})
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")
        return AudioTrack(**track)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching track: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)