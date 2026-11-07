import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types
from pydantic import BaseModel

# backend/app/diet.py -> backend/.env.local
# load_dotenv() does not override variables already set in the environment,
# so values injected by Docker's env_file take priority.
load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

router = APIRouter()

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")


@lru_cache(maxsize=1)
def get_client() -> genai.Client:
    """Create the Gemini client on first use so a missing key doesn't crash startup."""
    api_key = os.getenv("DIETING_KEY")
    if not api_key:
        raise RuntimeError("DIETING_KEY is not set. Add it to backend/.env.local.")
    return genai.Client(api_key=api_key)


# Validation contract for the request body: the AI is only called when both
# the fitness goal and the workout plan/notes are present.
class DietRequest(BaseModel):
    fitness_goal: str
    workout_plan: str


@router.post("/api/ai-diet")
async def generate_diet_recommendations(data: DietRequest):
    try:
        client = get_client()
    except RuntimeError as e:
        print("Gemini config error:", e)
        raise HTTPException(status_code=500, detail="AI service is not configured.")

    prompt = f"""
    You are an elite AI Sports Nutritionist analyzing a user's fitness profile.
    User Fitness Goal: {data.fitness_goal}
    User's Logged Activity/Notes: {data.workout_plan}

    Provide a direct, conversational, and tailored response.
    Suggest specific meals or order modifications if they mention fast food or restaurants.
    Speak naturally and directly to the user. Do not wrap your response in JSON format.
    """

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.7),
        )
        return {"ai_response": response.text}

    except Exception as e:
        # Log details server-side; don't send raw exception text to the browser.
        print("Gemini API Error Core:", str(e))
        raise HTTPException(status_code=500, detail="The AI service request failed.")