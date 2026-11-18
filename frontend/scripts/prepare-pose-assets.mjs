//include the runtime and model with the site so camera processing stays on the device
import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
let packageRoot;
try {
  //resolve the installed package so hoisted dependencies work too
  packageRoot = new URL('./', import.meta.resolve('@mediapipe/tasks-vision'));
  await Promise.all(['vision_bundle.mjs', 'wasm/'].map(path => access(new URL(path, packageRoot))));
} catch (error) {
  if (!['ERR_MODULE_NOT_FOUND', 'ENOENT'].includes(error.code)) throw error;
  console.error('Pose runtime is missing or incomplete. From frontend/ run "npm ci", then "npm run dev -- --host 0.0.0.0".');
  process.exit(1);
}
const output = new URL('../public/pose/', import.meta.url);
await mkdir(output, { recursive: true });
await cp(new URL('vision_bundle.mjs', packageRoot), new URL('vision_bundle.mjs', output));
await cp(new URL('wasm/', packageRoot), new URL('wasm/', output), { recursive: true });
const filename = new URL('pose_landmarker_full.task', output);
const expected = '5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
let existing;
try { existing = await readFile(filename); } catch { /*download the model if it is not here yet*/ }
if (!existing || digest(existing) !== expected) {
  const response = await fetch('https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task');
  if (!response.ok) throw new Error(`Pose model download: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes) !== expected) throw new Error('Pose model checksum mismatch');
  await writeFile(filename, bytes);
}
