import os
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.diet import router


class DietBypassTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

    def request_diet(self):
        return self.client.post(
            "/api/ai-diet",
            json={"fitness_goal": "endurance", "workout_plan": "Morning run"},
        )

    @patch.dict(os.environ, {}, clear=True)
    def test_missing_key_returns_demo_without_google_sdk(self):
        with patch.dict("sys.modules", {"google.genai": None}):
            response = self.request_diet()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["demo_mode"])
        self.assertIn("Demo mode", response.json()["ai_response"])

    @patch.dict(os.environ, {"GEMINI_API_KEY": "test-key", "GEMINI_BYPASS": "true"}, clear=True)
    def test_explicit_bypass_ignores_configured_key(self):
        with patch.dict("sys.modules", {"google.genai": None}):
            response = self.request_diet()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["demo_mode"])

    @patch.dict(os.environ, {}, clear=True)
    def test_demo_still_validates_request(self):
        response = self.client.post("/api/ai-diet", json={})
        self.assertEqual(response.status_code, 422)
