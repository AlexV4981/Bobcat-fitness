"""Measure warmed inference; optionally compare a measured surface-depth target."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import statistics
import time

import cv2
import numpy as np

from run import ROOT, configure_backend
from app.services.depth.onnx_inference import create_pose_model


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', type=Path, help='Image of a stationary planar depth target')
    parser.add_argument('--distance-m', type=float, help='Measured optical-axis distance to target center')
    parser.add_argument('--iterations', type=int, default=5)
    parser.add_argument('--output', type=Path, default=ROOT.parent / 'docs/camera-depth/benchmarks/onnx-cpu.json')
    args = parser.parse_args()
    if args.iterations < 2:
        parser.error('Use at least two measured iterations after warmup.')
    if args.distance_m is not None and (args.image is None or not np.isfinite(args.distance_m) or args.distance_m <= 0):
        parser.error('--distance-m requires a real target image and a finite positive measured distance.')
    if args.image:
        bgr = cv2.imread(str(args.image))
        if bgr is None:
            parser.error('Cannot read image.')
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    else:
        rgb = np.zeros((480, 640, 3), np.uint8)
    configure_backend('onnx', ROOT / '.env.onnx')
    report = {
        'input': 'real_image' if args.image else 'synthetic_blank',
        'image_shape': list(rgb.shape), 'python': platform.python_version(),
        'opencv': cv2.__version__, 'cpu_count': os.cpu_count(),
        'threads': int(os.environ.get('BOBCAT_ONNX_THREADS', min(6, os.cpu_count() or 1))),
        'models_sha256': {key: hashlib.sha256(Path(os.environ[key]).read_bytes()).hexdigest()
                          for key in ('BOBCAT_POSE_ONNX', 'BOBCAT_DEPTH_ONNX')},
        'limitations': 'Inference only; excludes network/display. Repeated image does not validate live joint jitter or exercise accuracy.',
        'runtimes': {},
    }
    for runtime in ('opencv', 'onnxruntime'):
        os.environ['BOBCAT_ONNX_RUNTIME'] = runtime
        cv2.setNumThreads(report['threads'])
        model = create_pose_model(None)
        samples = []
        try:
            model.process(rgb)  # Exclude cold start from the measured samples.
            for _ in range(args.iterations):
                start = time.perf_counter()
                result = model.process(rgb)
                samples.append({'total_ms': (time.perf_counter() - start) * 1000, **result.inference_ms})
            summary = {'samples': samples,
                       'median_ms': statistics.median(s['total_ms'] for s in samples),
                       'p95_ms': float(np.percentile([s['total_ms'] for s in samples], 95))}
            if args.distance_m is not None:
                height, width = result.depth_meters.shape
                patch = result.depth_meters[height//2-2:height//2+3, width//2-2:width//2+3]
                valid = patch[np.isfinite(patch) & (patch > 0)]
                estimate = float(np.median(valid)) if valid.size else None
                summary['surface_depth_check'] = {
                    'reference_m': args.distance_m, 'estimated_m': estimate,
                    'absolute_error_m': abs(estimate - args.distance_m) if estimate is not None else None,
                    'valid_fraction': valid.size / patch.size,
                    'scope': 'Center 5x5 target patch; does not establish anatomical joint-depth accuracy.',
                }
            report['runtimes'][runtime] = summary
            print(runtime, json.dumps(summary), flush=True)
        finally:
            model.close()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(f'Saved {args.output}')


if __name__ == '__main__':
    main()
