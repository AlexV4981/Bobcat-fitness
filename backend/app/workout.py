"""AI Workout: generates a single workout or a multi-week program with Gemini.

The API key stays on the server (backend/.env.local -> WORKOUT_KEY), so it never
reaches the browser. The frontend calls POST /api/ai-workout.
"""

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import List, Literal

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, Field

# backend/app/workout.py -> backend/.env.local (same file diet.py reads)
load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

router = APIRouter()

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")


@lru_cache(maxsize=1)
def get_client() -> genai.Client:
    """Create the Gemini client on first use so a missing key doesn't crash startup."""
    api_key = os.getenv("WORKOUT_KEY")
    if not api_key:
        raise RuntimeError("WORKOUT_KEY is not set. Add it to backend/.env.local.")
    return genai.Client(api_key=api_key)


# ---------------------------------------------------------------------------
# Request body
# ---------------------------------------------------------------------------

class WorkoutRequest(BaseModel):
    mode: Literal["single", "program"] = "single"
    goal: str = Field(min_length=1, max_length=100)
    focus: str = Field(min_length=1, max_length=100)
    level: Literal["beginner", "intermediate", "advanced"]
    duration: int = Field(ge=10, le=120, description="Minutes per session")
    equipment: List[str] = Field(default_factory=list, max_length=12)
    notes: str = Field(default="", max_length=500)
    weeks: int = Field(default=6, ge=2, le=12)
    days_per_week: int = Field(default=3, ge=2, le=6)


# ---------------------------------------------------------------------------
# Prompts and response schemas
# ---------------------------------------------------------------------------

SYSTEM_SINGLE = """You are an experienced strength and conditioning coach. Design one complete, safe, realistic workout session.
Rules:
- Use ONLY the equipment listed. If "bodyweight only" is the sole item, use no equipment except household items like a chair or table.
- Fit the total time (warm-up + main work + rest + cool-down) to the requested duration.
- Match volume and exercise difficulty to the level. Give regressions in the cue when a move is hard for the level.
- "reps" can be a number, a range, per-side counts, or a time like "30 sec".
- For circuits, set rounds > 1, sets = 1 per exercise, and put the between-round rest on the last exercise.
- Cues are one short sentence about form.
- Respect any injuries or constraints in the notes. Do not give medical advice."""

SYSTEM_PROGRAM = """You are an experienced strength and conditioning coach. Design one complete, safe, realistic multi-week training program.
Rules:
- The program repeats the same set of training days every week. Write each training day ONCE.
- Use ONLY the equipment listed. If "bodyweight only" is the sole item, use no equipment except household items like a chair or table.
- Each training day must fit the session length (warm-up + main work + rest + cool-down).
- Split the days sensibly for the focus and days per week (for example full body x3, upper/lower x4, push/pull/legs x6). Do not train the same muscles hard on back-to-back days.
- Progressive overload: every exercise has a "weekly" array with EXACTLY one {sets, reps} entry per week, in week order. Progress gradually by adding reps, then sets, then a harder variation or load cue (for example "8 @ RPE 8", "heavier than last week").
- Programs of 4 weeks or more include a lighter deload week (fewer sets, easier reps), usually every 4th week. Mark it in weekNotes with deload = true.
- "weekNotes" has EXACTLY one entry per week, in order, each with a short focus (2-4 words) and one sentence of guidance.
- For circuits, set rounds > 1 and sets = 1 in every weekly entry; put the between-round rest on the last exercise.
- Match volume and difficulty to the level. Give a regression in the cue when a move is hard for the level.
- Cues are one short sentence about form. Respect any injuries or constraints in the notes. Do not give medical advice."""

_ITEM = {
    "type": "OBJECT",
    "properties": {"name": {"type": "STRING"}, "detail": {"type": "STRING"}},
    "required": ["name", "detail"],
}


def _block_schema(exercise_props: dict, exercise_required: list) -> dict:
    return {
        "type": "OBJECT",
        "properties": {
            "name": {"type": "STRING"},
            "rounds": {"type": "INTEGER"},
            "exercises": {
                "type": "ARRAY",
                "items": {"type": "OBJECT", "properties": exercise_props, "required": exercise_required},
            },
        },
        "required": ["name", "rounds", "exercises"],
    }


SINGLE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "title": {"type": "STRING"},
        "summary": {"type": "STRING"},
        "durationMin": {"type": "INTEGER"},
        "intensity": {"type": "STRING"},
        "warmup": {"type": "ARRAY", "items": _ITEM},
        "blocks": {
            "type": "ARRAY",
            "items": _block_schema(
                {
                    "name": {"type": "STRING"},
                    "sets": {"type": "INTEGER"},
                    "reps": {"type": "STRING"},
                    "restSec": {"type": "INTEGER"},
                    "cue": {"type": "STRING"},
                },
                ["name", "sets", "reps", "restSec", "cue"],
            ),
        },
        "cooldown": {"type": "ARRAY", "items": _ITEM},
    },
    "required": ["title", "summary", "durationMin", "intensity", "warmup", "blocks", "cooldown"],
}

PROGRAM_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "title": {"type": "STRING"},
        "summary": {"type": "STRING"},
        "intensity": {"type": "STRING"},
        "progression": {"type": "STRING"},
        "weekNotes": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "focus": {"type": "STRING"},
                    "note": {"type": "STRING"},
                    "deload": {"type": "BOOLEAN"},
                },
                "required": ["focus", "note", "deload"],
            },
        },
        "days": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING"},
                    "focus": {"type": "STRING"},
                    "durationMin": {"type": "INTEGER"},
                    "warmup": {"type": "ARRAY", "items": _ITEM},
                    "blocks": {
                        "type": "ARRAY",
                        "items": _block_schema(
                            {
                                "name": {"type": "STRING"},
                                "restSec": {"type": "INTEGER"},
                                "cue": {"type": "STRING"},
                                "weekly": {
                                    "type": "ARRAY",
                                    "items": {
                                        "type": "OBJECT",
                                        "properties": {"sets": {"type": "INTEGER"}, "reps": {"type": "STRING"}},
                                        "required": ["sets", "reps"],
                                    },
                                },
                            },
                            ["name", "restSec", "cue", "weekly"],
                        ),
                    },
                    "cooldown": {"type": "ARRAY", "items": _ITEM},
                },
                "required": ["name", "focus", "durationMin", "warmup", "blocks", "cooldown"],
            },
        },
    },
    "required": ["title", "summary", "intensity", "progression", "weekNotes", "days"],
}


def build_prompt(req: WorkoutRequest) -> str:
    equipment = ", ".join(req.equipment) if req.equipment else "bodyweight only"
    notes = req.notes.strip() or "none"
    if req.mode == "program":
        return (
            f"Build a {req.weeks}-week training program.\n"
            f"Weeks: {req.weeks}\n"
            f"Training days per week: {req.days_per_week}\n"
            f"Goal: {req.goal}\nFocus: {req.focus}\nLevel: {req.level}\n"
            f"Session length: {req.duration} minutes\n"
            f"Equipment available: {equipment}\n"
            f"Notes from the athlete: {notes}"
        )
    return (
        "Build a workout.\n"
        f"Goal: {req.goal}\nFocus: {req.focus}\nLevel: {req.level}\n"
        f"Total time: {req.duration} minutes\n"
        f"Equipment available: {equipment}\n"
        f"Notes from the athlete: {notes}"
    )


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

# A plain `def` route runs in FastAPI's thread pool, so the slow Gemini call
# doesn't block other requests (like the camera stream).
@router.post("/api/ai-workout")
def generate_workout(req: WorkoutRequest):
    try:
        client = get_client()
    except RuntimeError as e:
        print("Gemini config error:", e)
        raise HTTPException(status_code=500, detail="AI service is not configured. Add WORKOUT_KEY to backend/.env.local.")

    is_program = req.mode == "program"
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=build_prompt(req),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROGRAM if is_program else SYSTEM_SINGLE,
                response_mime_type="application/json",
                response_schema=PROGRAM_SCHEMA if is_program else SINGLE_SCHEMA,
                temperature=0.9,
            ),
        )
    except genai_errors.APIError as e:
        # Log details server-side; send the browser a short, useful message.
        print("Gemini API error:", e.code, e.message)
        if e.code == 429:
            raise HTTPException(status_code=429, detail="Rate limit hit on the AI key. Wait a minute and try again.")
        if e.code in (401, 403) or (e.code == 400 and "key" in str(e.message).lower()):
            raise HTTPException(status_code=500, detail="The AI key was rejected. Check WORKOUT_KEY in backend/.env.local.")
        if e.code == 404:
            raise HTTPException(status_code=503, detail="The AI model is unavailable. Check GEMINI_MODEL in backend/.env.local.")
        raise HTTPException(status_code=502, detail="The AI service request failed. Try again.")
    except Exception as e:
        print("Gemini request failed:", str(e))
        raise HTTPException(status_code=502, detail="The AI service request failed. Try again.")

    what = "program" if is_program else "workout"
    if not response.text:
        raise HTTPException(status_code=502, detail=f"The {what} came back empty. Try again.")
    try:
        result = json.loads(response.text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail=f"The {what} came back garbled. Try again.")
    if is_program and not result.get("days"):
        raise HTTPException(status_code=502, detail="The program came back without any training days. Try again.")
    return result
