"""Set up and launch either pose backend using the project's virtualenv."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import venv
import urllib.request

ROOT = Path(__file__).resolve().parent
VENV = ROOT / '.venv'
PYTHON = VENV / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')


def download_models():
    directory = ROOT / 'models'
    directory.mkdir(exist_ok=True)
    for model in json.loads((ROOT / 'onnx-models.json').read_text()):
        path = directory / model['filename']
        if path.exists():
            if hashlib.sha256(path.read_bytes()).hexdigest() != model['sha256']:
                raise ValueError(f'{path} differs from the pinned model. Move it before downloading.')
            print(f'{path.name}: checksum verified.')
            continue
        temporary = path.with_suffix('.part')
        try:
            print(f"Downloading {path.name}...", flush=True)
            digest = hashlib.sha256()
            with urllib.request.urlopen(model['url'], timeout=60) as response, temporary.open('wb') as output:
                while chunk := response.read(1024 * 1024):
                    digest.update(chunk)
                    output.write(chunk)
            if digest.hexdigest() != model['sha256']:
                raise ValueError(f'Checksum mismatch for {path.name}.')
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)


def configure_backend(backend, env_file):
    from dotenv import load_dotenv

    # Explicit process settings take precedence over the local configuration.
    if backend == 'onnx':
        load_dotenv(env_file, override=False)
    os.environ['BOBCAT_POSE_BACKEND'] = 'opencv_onnx' if backend == 'onnx' else 'mediapipe'
    if backend == 'onnx':
        for key in ('BOBCAT_POSE_ONNX', 'BOBCAT_DEPTH_ONNX', 'BOBCAT_CAMERA_CALIBRATIONS'):
            value = os.environ.get(key)
            if value:
                path = Path(value).expanduser()
                os.environ[key] = str(path if path.is_absolute() else ROOT / path)


def check_backend(backend):
    import numpy as np
    from app.services.depth.onnx_inference import create_pose_model

    if backend == 'mediapipe':
        import mediapipe as mp
        model = mp.solutions.pose.Pose()
    else:
        model = create_pose_model(None)
    try:
        # Exercise real inference, including model output compatibility checks.
        result = model.process(np.zeros((256, 192, 3), dtype=np.uint8))
    finally:
        model.close()
    if backend == 'onnx':
        from app.services.depth.reconstruction import load_camera_intrinsics

        path = os.environ.get('BOBCAT_CAMERA_CALIBRATIONS')
        if not path:
            print('Camera intrinsics are not configured; ONNX 3D tracking and rep counting will pause.')
        else:
            cameras = json.loads(Path(path).read_text())
            if not isinstance(cameras, dict) or not cameras:
                raise ValueError('Camera calibrations must be a nonempty JSON object keyed by camera ID.')
            for camera_id in cameras:
                load_camera_intrinsics(camera_id)
    print(f'{backend} inference check passed.', flush=True)
    if backend == 'onnx':
        print(f'Runtime: {model.runtime}; inference ms: {result.inference_ms}', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('backend', nargs='?', choices=('mediapipe', 'onnx'), default='mediapipe')
    parser.add_argument('--setup', action='store_true', help='Create .venv and install backend requirements')
    parser.add_argument('--download-models', action='store_true', help='Download and verify pinned ONNX models (about 121 MB)')
    parser.add_argument('--check', action='store_true', help='Check real inference without starting the server')
    parser.add_argument('--env-file', type=Path, default=ROOT / '.env.onnx')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--no-reload', action='store_true')
    args = parser.parse_args()

    if args.setup:
        if not PYTHON.is_file():
            venv.EnvBuilder(with_pip=True).create(VENV)
        subprocess.run([str(PYTHON), '-m', 'pip', 'install', '-r', str(ROOT / 'requirements.txt')], check=True)
        config = ROOT / '.env.onnx'
        if not config.exists():
            # Exclusive creation preserves an existing configuration.
            with config.open('x') as target:
                target.write((ROOT / '.env.onnx.example').read_text())
        (ROOT / 'models').mkdir(exist_ok=True)
        print('Setup complete. Start with: python backend/run.py mediapipe (or onnx).')
        if not args.download_models:
            return

    if args.download_models:
        try:
            download_models()
        except (OSError, ValueError) as error:
            parser.exit(1, f'Model download failed: {error}\n')
        return

    if not PYTHON.is_file():
        parser.error('Virtualenv missing. Run: python backend/run.py --setup')
    if Path(sys.prefix).resolve() != VENV.resolve():
        raise SystemExit(subprocess.call([str(PYTHON), str(Path(__file__).resolve()), *sys.argv[1:]]))

    args.env_file = args.env_file.resolve()
    os.chdir(ROOT)
    try:
        configure_backend(args.backend, args.env_file)
        # ONNX errors should surface now, before a camera request fails.
        if args.check or args.backend == 'onnx':
            check_backend(args.backend)
    except (ImportError, OSError, ValueError, RuntimeError) as error:
        parser.exit(1, f'{args.backend} setup failed: {error}\nSee docs/camera-depth/setup.md.\n')
    except Exception as error:
        # OpenCV importer errors carry model-specific diagnostics.
        parser.exit(1, f'{args.backend} inference failed: {error}\nSee docs/camera-depth/setup.md.\n')
    if not args.check:
        import uvicorn
        print(f'Starting with {args.backend}. Stop with Ctrl+C to switch backends.', flush=True)
        uvicorn.run('app.main:app', host=args.host, port=args.port, reload=not args.no_reload)


if __name__ == '__main__':
    main()
