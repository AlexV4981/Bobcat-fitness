import json
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from google.genai import errors as genai_errors

from app.workout import router

PROGRAM = {
    "title": "Test Plan",
    "summary": "s",
    "intensity": "Moderate",
    "progression": "Add reps.",
    "weekNotes": [{"focus": "a", "note": "n", "deload": False}],
    "days": [{"name": "Day 1", "focus": "f", "durationMin": 45, "warmup": [], "blocks": [], "cooldown": []}],
}

BODY = {
    "mode": "program",
    "goal": "strength",
    "focus": "full body",
    "level": "intermediate",
    "duration": 45,
    "equipment": ["dumbbells"],
    "notes": "",
    "weeks": 6,
    "days_per_week": 4,
}


def fake_client(text):
    client = MagicMock()
    client.models.generate_content.return_value = SimpleNamespace(text=text)
    return client


class AIWorkoutRouteTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

    def test_program_request_sends_weeks_and_days_and_returns_json(self):
        client = fake_client(json.dumps(PROGRAM))
        with patch("app.workout.get_client", return_value=client):
            response = self.client.post("/api/ai-workout", json=BODY)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["title"], "Test Plan")
        prompt = client.models.generate_content.call_args.kwargs["contents"]
        self.assertIn("Weeks: 6", prompt)
        self.assertIn("Training days per week: 4", prompt)

    def test_single_workout_uses_single_prompt(self):
        client = fake_client(json.dumps({"title": "One"}))
        with patch("app.workout.get_client", return_value=client):
            response = self.client.post("/api/ai-workout", json={**BODY, "mode": "single"})
        self.assertEqual(response.status_code, 200)
        prompt = client.models.generate_content.call_args.kwargs["contents"]
        self.assertTrue(prompt.startswith("Build a workout."))

    def test_missing_key_returns_clear_error(self):
        with patch("app.workout.get_client", side_effect=RuntimeError("WORKOUT_KEY is not set")):
            response = self.client.post("/api/ai-workout", json=BODY)
        self.assertEqual(response.status_code, 500)
        self.assertIn("WORKOUT_KEY", response.json()["detail"])

    def test_rate_limit_is_passed_through(self):
        client = MagicMock()
        client.models.generate_content.side_effect = genai_errors.APIError(429, {"error": {"message": "quota"}})
        with patch("app.workout.get_client", return_value=client):
            response = self.client.post("/api/ai-workout", json=BODY)
        self.assertEqual(response.status_code, 429)

    def test_program_without_days_is_rejected(self):
        with patch("app.workout.get_client", return_value=fake_client(json.dumps({**PROGRAM, "days": []}))):
            response = self.client.post("/api/ai-workout", json=BODY)
        self.assertEqual(response.status_code, 502)

    def test_garbled_reply_is_rejected(self):
        with patch("app.workout.get_client", return_value=fake_client("not json")):
            response = self.client.post("/api/ai-workout", json=BODY)
        self.assertEqual(response.status_code, 502)

    def test_out_of_range_weeks_is_a_validation_error(self):
        response = self.client.post("/api/ai-workout", json={**BODY, "weeks": 40})
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
