import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# backend/app/diet.py -> backend/.env.local
# Preserve values already supplied by the environment (including Docker).
load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

router = APIRouter()

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")


# Validation contract for the request body: the AI is only called when both
# the fitness goal and the workout plan/notes are present.
class DietRequest(BaseModel):
    fitness_goal: str
    workout_plan: str


@router.post("/api/ai-diet")
async def generate_diet_recommendations(data: DietRequest):
    api_key = (
        os.getenv("DIETING_KEY", "").strip()
        or os.getenv("GOOGLE_API_KEY", "").strip()
        or os.getenv("GEMINI_API_KEY", "").strip()
    )
    if not api_key or os.getenv("GEMINI_BYPASS", "").lower() in {"1", "true", "yes"}:
        return {
            "ai_response": (
                "Demo mode: Gemini is temporarily bypassed. "
                "Your message was received, but no AI nutrition advice was generated. "
                "You can keep using the manual logs and checklist."
            ),
            "demo_mode": True,
        }

    prompt = f"""
    You are an elite AI Sports Nutritionist analyzing a user's fitness profile.
    User Fitness Goal: {data.fitness_goal}
    User's Logged Activity/Notes: {data.workout_plan}

    Provide a direct, conversational, and tailored response.
    Suggest specific meals or order modifications if they mention fast food or restaurants.
    Speak naturally and directly to the user. Do not wrap your response in JSON format.
    """

    try:
        # Keep the optional SDK and client out of startup and demo mode.
        from google import genai
        from google.genai import types

        with genai.Client(api_key=api_key) as client:
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