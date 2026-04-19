from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import re
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import base64

ROOT_DIR = Path(__file__).parent
try:
    load_dotenv(ROOT_DIR / '.env', override=True)
except Exception as e:
    logging.exception("dotenv not loaded")

# Configure logging immediately after dotenv so all startup code can use it
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
logger.info(f"DB name: {os.environ['DB_NAME']}")

# Create the main app without a prefix
app = FastAPI(title="Brutality Fitness API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

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

class CalloutRequest(BaseModel):
    complexity: float
    intensity: float
    round_number: int
    previous_move: str = ""

class CalloutResponse(BaseModel):
    command: str
    duration_ms: int
    muscle_groups: List[str] = []

class MuscleInfoRequest(BaseModel):
    move: str

class MuscleInfoResponse(BaseModel):
    move: str
    primary_muscles: List[str]
    secondary_muscles: List[str]
    description: str

# ---------------------------------------------------------------------------
# WorkoutEngine (rule-based fallback)
# ---------------------------------------------------------------------------

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
            move_number = random.randint(1, 4)
            command = str(move_number)
            duration_ms = move_number * 1000 + 1500

        elif complexity <= 0.4:
            if random.random() < intensity:
                move_number = random.randint(1, 4)
                command = f"Defense and {move_number}"
                duration_ms = 1500 + (move_number * 1000) + 1500
            else:
                move_number = random.randint(1, 4)
                command = str(move_number)
                duration_ms = move_number * 1000 + 1500

        else:
            if random.random() < 0.5:
                moves = ["Left straight", "Right straight", "Left hook", "Right uppercut"]
                combo = []
                num_moves = random.randint(2, 4)
                if random.random() < intensity:
                    combo.append("Defense")
                for _ in range(num_moves):
                    combo.append(random.choice(moves))
                command = ", ".join(combo)
                duration_ms = len(combo) * 1500
            else:
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

    def generate_callout(self, complexity: float, intensity: float, round_num: int, previous_move: str = "") -> CalloutResponse:
        """Generate a callout response using rule-based logic (fallback for LLM)."""
        import random

        moves_short = ["1", "2", "3", "4"]
        moves_named = ["Left straight", "Right straight", "Left hook", "Right uppercut"]

        if complexity < 0.2:
            command = random.choice(moves_short)
            duration_ms = (int(command) * 1000) + 1500
        elif complexity < 0.5:
            a, b = random.sample(moves_short, 2)
            command = f"{a}-{b}"
            duration_ms = 3000
        else:
            combo_count = random.randint(2, 4)
            parts = []
            if intensity > 0.5 and random.random() < intensity:
                parts.append("Defense")
            for _ in range(combo_count):
                parts.append(random.choice(moves_named if complexity > 0.6 else moves_short))
            command = ", ".join(parts)
            duration_ms = len(parts) * 1500

        # Avoid repeating the previous move
        if command == previous_move:
            command = random.choice(moves_short)
            duration_ms = (int(command) * 1000) + 1500

        return CalloutResponse(command=command, duration_ms=duration_ms, muscle_groups=[])


workout_engine = WorkoutEngine()

# ---------------------------------------------------------------------------
# LlmEngine (TinyLlama via HuggingFace transformers)
# ---------------------------------------------------------------------------

# Valid callout pattern: digits 1-4, "Defense", commas, hyphens, spaces
_CALLOUT_PATTERN = re.compile(
    r'^[\d,\-\s]*(Defense[\s,\-]*)?([\d,\-\s]*(Defense[\s,\-]*)?)*$',
    re.IGNORECASE
)

CALLOUT_SYSTEM = (
    "You are a boxing trainer calling out combinations during a workout. "
    "Respond with ONLY the combination command — no explanation, no commentary, no punctuation beyond commas and hyphens. "
    "Valid moves: 1 (left jab), 2 (right cross), 3 (left hook), 4 (right uppercut), Defense. "
    "Examples: 1-2, Defense 3, 1-2-3, 4, Defense 1-2, 1-2-3-4"
)

MUSCLE_SYSTEM = (
    "You are a sports anatomy expert. When given a boxing move, respond in exactly this JSON format with no other text: "
    '{"primary": ["muscle1", "muscle2"], "secondary": ["muscle3"], "description": "one short sentence"}'
)


class LlmEngine:
    _tokenizer = None
    _model = None
    _loaded: bool = False

    @classmethod
    def _load_blocking(cls) -> None:
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM

        model_id = os.environ.get("TINYLLAMA_MODEL", "TinyLlama/TinyLlama-1.1B-Chat-v1.0")
        logger.info(f"Loading model: {model_id}")
        cls._tokenizer = AutoTokenizer.from_pretrained(model_id)
        cls._model = AutoModelForCausalLM.from_pretrained(
            model_id, device_map="auto", torch_dtype="auto"
        )
        cls._model.eval()
        cls._loaded = True
        logger.info("LlmEngine: model loaded successfully")

    @classmethod
    async def load(cls) -> None:
        await asyncio.to_thread(cls._load_blocking)

    @classmethod
    def _generate_blocking(cls, messages: list, max_new_tokens: int) -> str:
        import torch

        # apply_chat_template returns a BatchEncoding (dict-like) in transformers>=4.40,
        # not a raw tensor — extract input_ids explicitly to avoid KeyError: 'shape'
        raw = cls._tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_tensors="pt",
        )
        if hasattr(raw, 'input_ids'):
            input_ids = raw.input_ids.to(cls._model.device)
        elif isinstance(raw, dict):
            input_ids = raw['input_ids'].to(cls._model.device)
        else:
            input_ids = raw.to(cls._model.device)

        input_length = input_ids.shape[-1]

        with torch.no_grad():
            output = cls._model.generate(
                input_ids,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                temperature=0.7,
                top_p=0.9,
                repetition_penalty=1.1,
                pad_token_id=cls._tokenizer.eos_token_id,
            )

        new_tokens = output[0][input_length:]
        return cls._tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

    @classmethod
    async def generate(cls, messages: list, max_new_tokens: int = 60) -> str:
        if not cls._loaded or cls._model is None:
            raise RuntimeError("LlmEngine not loaded")
        return await asyncio.to_thread(cls._generate_blocking, messages, max_new_tokens)


def _build_callout_messages(complexity: float, intensity: float, round_num: int, previous_move: str) -> list:
    if complexity < 0.2:
        combo_length = "single move (one digit only)"
    elif complexity < 0.6:
        combo_length = "2-move combination"
    else:
        combo_length = "3 or 4 move combination"

    defense_instruction = "include Defense" if intensity > 0.5 else "no Defense"
    user_msg = f"Round {round_num}, {combo_length}, {defense_instruction}."
    if previous_move:
        user_msg += f" Previous: {previous_move}. Choose something different."

    return [
        {"role": "system", "content": CALLOUT_SYSTEM},
        {"role": "user", "content": user_msg},
    ]


def _estimate_duration(command: str) -> int:
    tokens = [t.strip() for t in re.split(r'[,\-\s]+', command) if t.strip()]
    return len(tokens) * 1200 + 800


def _validate_callout(raw: str) -> Optional[str]:
    """Return cleaned callout if valid, else None."""
    cleaned = raw.strip().strip('"\'').strip()

    # Strip common LLM preamble phrases
    for prefix in ("here's", "here is", "call out", "combo:", "move:", "i say", "say", "call"):
        if cleaned.lower().startswith(prefix):
            cleaned = cleaned[len(prefix):].strip(' :-')

    # Full match: only digits, Defense, commas, hyphens, spaces
    if re.fullmatch(r'[\d,\-\s]*(Defense[\s,\-]*[\d,\-\s]*)*', cleaned, re.IGNORECASE):
        result = cleaned.strip()
        return result if result else None

    # Partial match: find the first valid combo anywhere in the output
    match = re.search(
        r'\b(?:Defense[\s,\-]*)?[1-4](?:[\s,\-]+[1-4])*(?:[\s,\-]+Defense)?',
        cleaned,
        re.IGNORECASE,
    )
    if match:
        return match.group(0).strip(' ,\-')

    # Last resort: if the first token is a single digit, use it
    first = cleaned.split()[0] if cleaned.split() else ''
    if first in ('1', '2', '3', '4'):
        return first

    return None


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@api_router.get("/health")
async def health_check():
    """Health check including LLM readiness."""
    return {
        "status": "ok",
        "llm_ready": LlmEngine._loaded,
        "llm_backend": os.environ.get("LLM_BACKEND", "rule-based"),
    }

@api_router.get("/")
async def root():
    return {"message": "Brutality Fitness API - Ready to train!"}

@api_router.post("/workout/start", response_model=WorkoutSession)
async def start_workout(session_data: WorkoutSessionCreate):
    """Start a new workout session"""
    logging.info(f"Entered /workout/start with user_id={session_data.user_id}")
    try:
        logger.info(f"start_workout called for user_id={session_data.user_id}")
        session = WorkoutSession(**session_data.dict())
        session_dict = session.dict()
        logging.info(f"Inserting session: {session_dict}")
        await db.workout_sessions.insert_one(session_dict)
        logger.info("insert succeeded")
        return session
    except Exception as e:
        logger.exception("Error starting workout")
        raise HTTPException(status_code=500, detail=f"Error starting workout: {str(e)}")

@api_router.get("/workout/{session_id}", response_model=WorkoutSession)
async def get_workout_session(session_id: str):
    """Get workout session details"""
    try:
        session = await db.workout_sessions.find_one({"id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Workout session not found")
        return WorkoutSession(**session)
    except HTTPException:
        raise
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

@api_router.post("/llm/callout", response_model=CalloutResponse)
async def llm_callout(request: CalloutRequest):
    """Generate a workout callout using the configured LLM backend."""
    backend = os.environ.get("LLM_BACKEND", "rule-based")

    if backend == "tinyllama" and LlmEngine._loaded:
        try:
            messages = _build_callout_messages(
                request.complexity, request.intensity,
                request.round_number, request.previous_move
            )
            raw = await asyncio.wait_for(
                LlmEngine.generate(messages, max_new_tokens=30),
                timeout=8.0,
            )
            command = _validate_callout(raw)
            if command:
                return CalloutResponse(
                    command=command,
                    duration_ms=_estimate_duration(command),
                    muscle_groups=[],
                )
            logger.warning(f"LLM callout failed validation (raw={raw!r}), falling back")
        except asyncio.TimeoutError:
            logger.warning("LLM callout timed out, falling back to rule-based")
        except Exception as e:
            logger.exception(f"LLM callout error: {e}")

    # Fallback: rule-based
    return workout_engine.generate_callout(
        request.complexity, request.intensity,
        request.round_number, request.previous_move
    )

@api_router.post("/llm/muscle-info", response_model=MuscleInfoResponse)
async def llm_muscle_info(request: MuscleInfoRequest):
    """Return anatomical muscle info for a given boxing move."""
    backend = os.environ.get("LLM_BACKEND", "rule-based")

    if backend == "tinyllama" and LlmEngine._loaded:
        try:
            messages = [
                {"role": "system", "content": MUSCLE_SYSTEM},
                {"role": "user", "content": f"Move: {request.move}"},
            ]
            raw = await asyncio.wait_for(
                LlmEngine.generate(messages, max_new_tokens=80),
                timeout=10.0,
            )
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', raw, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(0))
                return MuscleInfoResponse(
                    move=request.move,
                    primary_muscles=data.get("primary", []),
                    secondary_muscles=data.get("secondary", []),
                    description=data.get("description", ""),
                )
        except (asyncio.TimeoutError, json.JSONDecodeError, Exception) as e:
            logger.warning(f"Muscle info LLM error ({type(e).__name__}), using static fallback")

    # Static fallback
    return _static_muscle_info(request.move)

def _static_muscle_info(move: str) -> MuscleInfoResponse:
    """Static anatomical data fallback when LLM is unavailable."""
    static = {
        "1": ("Left jab", ["anterior deltoid", "triceps brachii"], ["serratus anterior", "core"], "A fast linear punch engaging the front shoulder and triceps."),
        "2": ("Right cross", ["pectoralis major", "triceps brachii"], ["core rotators", "hip flexors"], "A power punch driven by hip rotation and the chest."),
        "3": ("Left hook", ["pectoralis major", "biceps brachii"], ["obliques", "latissimus dorsi"], "A circular punch engaging the chest and obliques through rotation."),
        "4": ("Right uppercut", ["biceps brachii", "deltoid"], ["quadriceps", "glutes"], "An upward punch driven by leg drive and the bicep."),
        "Defense": ("Defensive movement", ["core stabilizers", "glutes"], ["hamstrings", "calves"], "Active footwork and slipping engage the full posterior chain."),
    }
    # Try to match by digit or keyword
    for key, (_, primary, secondary, desc) in static.items():
        if key.lower() in move.lower():
            return MuscleInfoResponse(
                move=move,
                primary_muscles=primary,
                secondary_muscles=secondary,
                description=desc,
            )
    return MuscleInfoResponse(
        move=move,
        primary_muscles=["full body"],
        secondary_muscles=[],
        description="Combination movement engaging multiple muscle groups.",
    )

class BreakTipRequest(BaseModel):
    move: str
    primary_muscles: List[str] = []
    round_number: int = 1

class BreakTipResponse(BaseModel):
    tip: str

BREAK_TIP_SYSTEM = (
    "You are a boxing trainer speaking to your fighter during a rest break. "
    "In exactly 2 sentences: first say which muscles the last move worked, then give one specific technique or form tip for that punch. "
    "Sound like you are talking directly to them — encouraging, clear, conversational. "
    "Do NOT use bullet points. Keep the total under 40 words."
)

@api_router.post("/llm/break-tip", response_model=BreakTipResponse)
async def llm_break_tip(request: BreakTipRequest):
    """Generate a conversational muscle coaching tip for the rest break."""
    backend = os.environ.get("LLM_BACKEND", "rule-based")

    if backend == "tinyllama" and LlmEngine._loaded:
        muscles_str = ", ".join(request.primary_muscles) if request.primary_muscles else "multiple muscle groups"
        messages = [
            {"role": "system", "content": BREAK_TIP_SYSTEM},
            {"role": "user", "content": (
                f"Last combination: {request.move}. "
                f"Muscles worked: {muscles_str}. "
                f"Round {request.round_number} just finished. Give the coaching tip."
            )},
        ]
        try:
            raw = await asyncio.wait_for(
                LlmEngine.generate(messages, max_new_tokens=60),
                timeout=12.0,
            )
            tip = raw.strip().strip('"\'')
            if tip:
                return BreakTipResponse(tip=tip)
        except (asyncio.TimeoutError, Exception) as e:
            logger.warning(f"Break tip LLM error ({type(e).__name__}), using static fallback")

    # Static fallback
    return BreakTipResponse(tip=_static_break_tip(request.move, request.primary_muscles))

def _static_break_tip(move: str, muscles: List[str]) -> str:
    """Rule-based coaching tips when LLM is unavailable."""
    static = {
        "1": "Your jab works your front shoulder and triceps. Make sure to snap it back fast to keep your guard up.",
        "2": "The cross drives through your chest and core. Plant your back foot and rotate your hip into it for real power.",
        "3": "Hooks fire up your chest and obliques. Keep your elbow level and rotate your whole torso, not just your arm.",
        "4": "Uppercuts come from your legs. Bend your knees slightly and drive upward through your bicep and shoulder.",
        "Defense": "Slipping and footwork engage your entire core and legs. Stay light on your toes and keep your hands up as you move.",
    }
    for key, tip in static.items():
        if key.lower() in move.lower():
            return tip
    if muscles:
        muscle_str = " and ".join(muscles[:2])
        return f"That combination really worked your {muscle_str}. Stay loose and breathe deep during your rest."
    return "Good round. Focus on your breathing and stay hydrated before we go again."

@api_router.post("/tts/generate", response_model=TTSResponse)
async def generate_speech(request: TTSRequest):
    """Generate text-to-speech audio. Returns empty audio_base64 if no OpenAI key configured."""
    try:
        openai_key = os.environ.get('OPENAI_API_KEY')
        if openai_key:
            import openai
            oai_client = openai.AsyncOpenAI(api_key=openai_key)
            response = await oai_client.audio.speech.create(
                model="tts-1",
                voice=request.voice,
                input=request.text,
                speed=request.speed,
            )
            audio_base64 = base64.b64encode(response.content).decode('utf-8')
        else:
            audio_base64 = ""

        tts_record = {
            "id": str(uuid.uuid4()),
            "text": request.text,
            "voice": request.voice,
            "speed": request.speed,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.tts_requests.insert_one(tts_record)

        return TTSResponse(
            audio_base64=audio_base64,
            text=request.text,
            voice=request.voice,
        )
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

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Verify MongoDB
    try:
        await client.admin.command("ping")
        logger.info("MongoDB ping succeeded")
    except Exception:
        logger.exception("MongoDB startup check failed")
        raise

    # Load LLM if configured
    backend = os.environ.get("LLM_BACKEND", "rule-based")
    logger.info(f"LLM_BACKEND={backend}")
    if backend == "tinyllama":
        logger.info("Loading TinyLlama model (this may take 30–120 seconds)...")
        try:
            await LlmEngine.load()
        except Exception:
            logger.exception("Failed to load TinyLlama — falling back to rule-based")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.body()
    logging.error(f"Validation error on {request.url}: {exc.errors()}")
    logging.error(f"Raw body: {body.decode('utf-8', errors='ignore')}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
