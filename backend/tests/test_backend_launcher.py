import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from run import ROOT, configure_backend


class BackendLauncherTests(unittest.TestCase):
    def test_onnx_loads_configuration_and_resolves_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / 'onnx.env'
            env_file.write_text('BOBCAT_POSE_ONNX=models/pose.onnx\nBOBCAT_DEPTH_ONNX=models/depth.onnx\n')
            with patch.dict(os.environ, {}, clear=True):
                configure_backend('onnx', env_file)
                self.assertEqual(os.environ['BOBCAT_POSE_BACKEND'], 'opencv_onnx')
                self.assertEqual(os.environ['BOBCAT_POSE_ONNX'], str(ROOT / 'models/pose.onnx'))
                self.assertEqual(os.environ['BOBCAT_DEPTH_ONNX'], str(ROOT / 'models/depth.onnx'))

    def test_process_settings_override_file_but_command_selects_backend(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / 'onnx.env'
            env_file.write_text('BOBCAT_POSE_ONNX=models/ignored.onnx\nBOBCAT_POSE_BACKEND=mediapipe\n')
            with patch.dict(os.environ, {'BOBCAT_POSE_ONNX': '/custom/pose.onnx'}, clear=True):
                configure_backend('onnx', env_file)
                self.assertEqual(os.environ['BOBCAT_POSE_ONNX'], '/custom/pose.onnx')
                self.assertEqual(os.environ['BOBCAT_POSE_BACKEND'], 'opencv_onnx')

    def test_mediapipe_switch_ignores_onnx_configuration(self):
        with patch.dict(os.environ, {'BOBCAT_POSE_BACKEND': 'opencv_onnx'}, clear=True):
            configure_backend('mediapipe', Path('/missing/config'))
            self.assertEqual(os.environ['BOBCAT_POSE_BACKEND'], 'mediapipe')
            self.assertNotIn('BOBCAT_POSE_ONNX', os.environ)
