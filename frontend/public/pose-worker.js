//use a classic worker so the MediaPipe WASM loader can still call importScripts
let landmarker, files, options;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const { FilesetResolver, PoseLandmarker } = await import('./pose/vision_bundle.mjs');
      files = await FilesetResolver.forVisionTasks(new URL('./pose/wasm', self.location.href).href);
      options = {
        baseOptions: { modelAssetPath: new URL('./pose/pose_landmarker_full.task', self.location.href).href, delegate: 'GPU' },
        runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: 0.7, minPosePresenceConfidence: 0.7, minTrackingConfidence: 0.7,
        outputSegmentationMasks: false,
      };
      let delegate = 'GPU';
      try { landmarker = await PoseLandmarker.createFromOptions(files, options); }
      catch {
        delegate = 'CPU';
        options.baseOptions.delegate = delegate;
        landmarker = await PoseLandmarker.createFromOptions(files, options);
      }
      self.postMessage({ type: 'ready', delegate });
    } else if (data.type === 'useCPU') {
      landmarker.close();
      options.baseOptions.delegate = 'CPU';
      const { PoseLandmarker } = await import('./pose/vision_bundle.mjs');
      landmarker = await PoseLandmarker.createFromOptions(files, options);
      self.postMessage({ type: 'ready', delegate: 'CPU' });
    } else if (data.type === 'frame') {
      const started = performance.now();
      const result = landmarker.detectForVideo(data.bitmap, data.capturedAt);
      self.postMessage({ type: 'result', bitmap: data.bitmap, capturedAt: data.capturedAt,
        landmarks: result.landmarks[0] ?? [], inferenceMs: performance.now() - started }, [data.bitmap]);
    }
  } catch (error) {
    data.bitmap?.close();
    self.postMessage({ type: 'error', message: error.message || String(error) });
  }
};
