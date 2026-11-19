import json
import os
from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# backend/app/diet.py -> backend/.env.local
# Preserve values already supplied by the environment (including Docker).
load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

router = APIRouter()

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

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
    wpo_summary: Optional[str] = None
    current_dpo: Optional[dict] = None

class DayLog(BaseModel):
    day: str
    calories: int
    protein: int
    carbs: int
    fats: int
    meals: List[str]

class DietPlanObject(BaseModel):
    version: str = "1.0"
    goal: str
    source_workout_title: str
    daily_calorie_target: int
    daily_protein_target_g: int
    weekly_schedule: List[DayLog]
    action_checklist: List[str]

class DietResponse(BaseModel):
    ai_response: str
    updated_dpo: Optional[DietPlanObject] = None

@router.post("/api/ai-diet", response_model=DietResponse)
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
    Imported Workout Plan Context: {data.wpo_summary or "None provided"}
    Current Diet Plan Object (DPO): {json.dumps(data.current_dpo) if data.current_dpo else "None yet"}
    User's Logged Activity/Notes: {data.workout_plan}

    Provide a direct, conversational, and tailored response in 'ai_response'.
    Suggest specific meals or order modifications if they mention fast food or restaurants.
    Speak naturally and directly to the user.
    Whenever the user asks to build, generate, or modify a diet plan (or when a workout plan is provided to build a plan from), populate 'updated_dpo' with a complete 7-day schedule (Mon through Sun) tailored to their workout intensity and goal. Otherwise set 'updated_dpo' to null.
    """

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=1200,
                response_mime_type="application/json",
                response_schema=DietResponse,
            ),
        )
        parsed = json.loads(response.text)
        return DietResponse(**parsed)

    except Exception as e:
        # Log details server-side; don't send raw exception text to the browser.
        print("Gemini API Error Core:", str(e))
        raise HTTPException(status_code=500, detail="The AI service request failed.")
    
