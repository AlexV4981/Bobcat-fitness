# Bobcat Fitness — Private Gemini AI on Cloudflare Pages

**Status:** This implementation is staged only on `deploy/cloudflare-pages-class-demo`. Production `main` and the live `bobcat-fitness.pages.dev` deployment will not receive these changes until someone merges the branch content into `main`. No PR created.

## Why the previous application could not safely use a shared key

- AI Dieting previously sent API requests to `http://localhost:8000/api/ai-diet`. A visitor cannot reach the presenter's laptop by using localhost.
- AI Workout previously used `VITE_API_KEY` and sent calls directly to Gemini from the browser; that reveals any shared key to all visitors.
- Merely adding an encrypted Cloudflare variable does not repair either feature: the application needs a server-side endpoint.

## Staged implementation

- `frontend/functions/api/ai-diet.js`: same-origin Pages Function at `POST /api/ai-diet`.
- `frontend/functions/api/ai-workout.js`: same-origin Pages Function at `POST /api/ai-workout`.
- `frontend/server/aiGateway.js`: server-only Gemini calls, user verification and demo usage limits.
- Frontend pages now call those endpoints with their existing Supabase access tokens; they never receive a Gemini API key.
- No FastAPI or Python process is required for these **two** AI actions.
- Camera inference remains fully on the visitor's device.
- **For safety, AI requests require an actual signed-in Supabase account. Guest mode still works for the camera, but guests cannot generate AI nutrition or workouts.** This avoids creating a free, public, anonymous Gemini relay.

## Exact authenticated steps (the user must do these, not Codex)

### 1. Create a Gemini API key

1. Visit https://aistudio.google.com/apikey and sign into your own Google account.
2. Create or select a project and issue a Gemini API key. Restrict a standard key to the Generative Language API; new AI Studio auth keys are normally restricted by default.
3. Check your project's actual rate limits and billing tier. Use a conservative free tier if appropriate and configure project spend caps if billing is enabled.
4. Never post the key in ChatGPT, commit it, or put it in any variable starting with `VITE_`.

### 2. Save the key as an encrypted Cloudflare Pages Function secret

1. Open https://dash.cloudflare.com/ -> **Workers & Pages** -> **bobcat-fitness**.
2. Go to **Settings -> Variables and Secrets** (or the equivalent environment-variable section).
3. Select **Production** and add:
   - Name: `GEMINI_API_KEY`
   - Value: your real Gemini key
   - **Encrypt: ON** (a secret, not plaintext).
4. Add a normal **server-side** variable:
   - Name: `GEMINI_MODEL`
   - Value: `gemini-3.5-flash-lite` (or another text model supported by your key's project).
5. Keep the existing public Supabase settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_AUTH_EMAIL_DOMAIN`.
6. **Remove `VITE_API_KEY` if present**. If you ever deployed the real Gemini key through `VITE_API_KEY`, treat it as exposed and revoke/rotate it in Google AI Studio first.
7. `VITE_MODEL` is no longer used by these endpoints; remove it if desired.
8. For preview testing, configure the same bindings/secrets for **Preview** only if you intend to run real Gemini calls on preview deployments.

### 3. Create a free KV namespace for best-effort AI limits

1. In the Cloudflare dashboard, open **Workers KV** (sometimes under Storage & databases -> KV).
2. Create a namespace, e.g. `bobcat-ai-demo-limits`.
3. Open **Workers & Pages -> bobcat-fitness -> Settings -> Bindings -> Add -> KV namespace**.
4. Set **Variable name** to **`AI_RATE_LIMITS`**, and select your newly created KV namespace.
5. Apply it to Production, and Preview if you are testing the preparation branch.
6. Redeploy so the binding is attached to the Functions.

The demo gateway enforces about **six attempts per signed-in user per day**, plus a 12-second cooldown. This is a **best-effort** limit: Workers KV is eventually consistent and simultaneous requests can race. It is **not a guaranteed billing or abuse cap**. Keep Google's own quotas/spend caps in place. The API fails closed if the KV binding, secret, or Supabase configuration is absent.

### 4. Publish these changes to production

The live Pages project has `main` set as its production branch, correctly. This security implementation is **not** on `main` yet.

- First, test a **preview deployment** of `deploy/cloudflare-pages-class-demo`; ensure Cloudflare preview builds are enabled, preview secret/binding are configured, and the Functions deploy.
- Once tested and with your team's agreement, merge the changes into `main` yourself or by your normal teammate workflow. **No automatic merge and no PR have been created on your behalf.**
- Cloudflare will automatically build and publish the new `main` commit. No laptop server or new Cloudflare project is needed.

## Tests to run after deployment

1. **Unauthenticated:** `POST /api/ai-diet` returns HTTP 401 and **does not call Gemini**.
2. **Guest:** camera loads, but AI Diet and AI Workout show a clear **sign-in required** message.
3. **Authenticated:** a real Supabase account can send a diet question and generate a workout without entering an API key.
4. **Security:** Browser DevTools Network must show requests to `/api/ai-diet` and `/api/ai-workout`, **not** to `generativelanguage.googleapis.com`. Inspect the request/response and built JS to verify the Gemini key is not present.
5. **Rate limit:** repeat a request within 12 seconds and verify HTTP 429; after six attempts in a day the account should be stopped.
6. **Build:** run `cd frontend && npm ci && node --test server/aiGateway.test.js && npm run build`.
7. **Operational:** ensure Cloudflare Pages Functions logs show no raw key or user diet text. Confirm Gemini billing and rate-limit dashboard are acceptable before opening the live demo to the public.

## Known scope and next work

- This implementation is intended for classroom-scale demonstrations, not general open anonymous AI access. Cloudflare KV's eventually consistent counters are not a strict rate limiter; for stronger protection use an atomic limiter (for example Durable Objects) and provider-side quotas.
- Users must sign in. To support **guest AI usage** safely, add Cloudflare Turnstile verification plus server-side per-IP and global quotas, then test abuse controls before enabling it. **Do not bypass authentication just to make guest testing easy.**
- The older Python backend can still be needed for other legacy API routes; this work replaces only the two identified AI generation calls.
- Google rate limits are model- and project-specific; a model identifier can return a 404 or a quota error despite successful Pages deployment. Verify the selected model in Google AI Studio.
