# Bobcat Fitness — Cloudflare Pages class-demo deployment

**Repository:** https://github.com/AlexV4981/Bobcat-fitness  
**Production source:** `main` (only after the team merges changes into it).  
**Preparation branch:** `deploy/cloudflare-pages-class-demo`  
**No PR is required to inspect or test this preparation branch.**  
**Hosting:** Cloudflare Pages Free, Git-connected. No laptop/SSD/Tunnel is needed for live hosting.

## Status and human login boundaries

The following are **manual, authenticated actions**. Codex/ChatGPT should not invent credentials, try to circumvent login, or claim these were completed:

1. **Cloudflare login:** open https://dash.cloudflare.com/ and log in.
2. **GitHub authorization:** in Workers & Pages, create a Pages project using Git integration and authorize access to `AlexV4981/Bobcat-fitness` if prompted.
3. **Team Supabase configuration:** obtain the existing **project URL**, **publishable** browser key, and exact `VITE_AUTH_EMAIL_DOMAIN` from the teammate who owns the Supabase environment. The repository's linked project reference alone is **not proof** that the user's authenticated Supabase account has access to it. Ask the teammate for the actual values if unavailable.
4. **Environment variables:** enter them in the Cloudflare Pages **production** environment, then redeploy. Configure preview separately only if testing authenticated account features in previews.
5. **Public verification:** open the actual Pages URL and test from a different browser/device. Do not label a deployment complete until this succeeds.

### What is already prepared in this branch

- `frontend/.node-version` pins Node.js `22.23.4`.
- `frontend/public/_headers` adds minimal static response headers.
- GitHub Actions frontend build check validates the pinned MediaPipe runtime/model and the 25 MiB per-file limit.
- No credentials or automatic public backend were added.

These preparations affect **this branch only** until the team chooses to merge them into `main`. **Cloudflare production should remain pointed at `main`**, even while you test the preparation branch via a preview or local build.

## Cloudflare dashboard: exact project settings

1. Sign in to **Workers & Pages → Create application → Pages → Connect to Git** (wording may vary).
2. Select `AlexV4981/Bobcat-fitness` (not a fork).
3. Project name: `bobcat-fitness-demo`, or another available name.
4. **Production branch:** `main`.
5. **Project root directory:** `frontend` (the repo also contains a separate, older root-level Vite app).
6. **Framework preset:** React (Vite) / Vite.
7. **Build command:** `npm run build`; npm's `prebuild` hook prepares pose assets.
8. **Build output directory:** `dist` (relative to `frontend`).
9. **Environment variable:** `NODE_VERSION=22.23.4` to explicitly select a compatible build runtime. If the dashboard uses a different version-selection mechanism, follow its current guidance.
10. Enable automatic production deployments from `main` and keep preview deployments on for branch-only checks. Cloudflare Pages generates a public `*.pages.dev` URL without requiring a purchased domain.

**Do not configure the Python/FastAPI backend as a Pages build.** The browser camera uses local MediaPipe inference and doesn't require a server.

### Required Vite environment variables (human-supplied)

| Variable | Source | Public browser-safe? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Team Supabase project URL | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Team Supabase **publishable** key, NOT a secret/service_role key | Yes |
| `VITE_AUTH_EMAIL_DOMAIN` | Existing team auth configuration | Yes |
| `NODE_VERSION` | `22.23.4` | Build setting |

The frontend creates its Supabase client during module initialization. Even the **Browse as Guest** button requires a working Supabase client configuration to avoid a blank page at startup. A real Supabase user is **not** required to use guest mode once the client initializes. Guest workout history is session-local; account persistence requires sign-in.

**Never set a private Gemini key as `VITE_API_KEY`**. Vite embeds `VITE_*` values in browser JavaScript. Do not put service-role keys, access tokens, or passwords into GitHub source or client environment variables.

### What will and will not work in this frontend-only demo

- **Browser camera / skeleton / squat reps**: intended to work over the Pages HTTPS URL (requires camera permission, a suitable browser, and device performance).
- **Guest browsing**: should work after the public Supabase client is configured.
- **Supabase login/profile and persistent workout records**: require the live team's Supabase project, schema, RLS and auth settings to be correct; test rather than assume.
- **AI Diet chat**: source presently calls `http://localhost:8000/api/ai-diet` from the browser and **will not work for remote visitors**. Do not promise this feature; it needs a separately hosted secure API and a same-origin or HTTPS API URL.
- **AI Workout generation**: currently calls Gemini from the browser. It needs an API key and should not ship with a shared private key. A sample workout display may work without generation.
- **Camera feature behavior after teammates' merges**: validate against the new `main`; do not assume existing functionality will be unchanged.

## Build verification (Codex/local machine)

Run from the repository root:

```bash
git fetch origin main
git switch deploy/cloudflare-pages-class-demo
cd frontend
npm ci
npm run build
test -s dist/index.html
test -s dist/pose-worker.js
test -s dist/pose/vision_bundle.mjs
test -s dist/pose/pose_landmarker_full.task
```

The preparation script downloads the verified MediaPipe model on the first build and requires internet access. Generated `frontend/public/pose/` and `frontend/dist/` files stay ignored in Git; never commit them.

If dependencies or model downloads fail, diagnose the **actual build error**. Do not bypass the checksum or remove pose assets to make a superficial build succeed. If `npm ci` reports incompatible lockfile or package versions, report that as an actionable blocker before altering dependency versions.

## Test the preparation branch without merging it

Cloudflare's Git integration can create a **preview deployment** for this branch once you authorize GitHub. The **production** branch must remain `main`. Verify the preview and then decide with teammates whether to merge the small deployment-preparation changes into `main`. Do not create a PR or merge on the user's behalf.

The static site on `main` may already deploy with the dashboard settings above; the branch's extra CI/header/node files are **recommended checks**, not strictly required to perform the first deployment.

## Classroom test checklist

- [ ] Cloudflare production deployment says **Success** and points to `main`.
- [ ] Production URL opens from a private browser window and a phone on mobile data.
- [ ] Login screen renders without a blank page; **Browse as Guest** navigates to the app.
- [ ] Camera page requests permission and renders a real live feed.
- [ ] `/pose-worker.js` is accessible.
- [ ] `/pose/vision_bundle.mjs`, `/pose/pose_landmarker_full.task`, and expected `/pose/wasm/` files load (not a fallback HTML page).
- [ ] Full-body squat shows a responsive overlay and increments reps; manually test on a low-end or mobile device.
- [ ] After a teammate merges into `main`, the new production deployment succeeds; the public URL remains constant.
- [ ] Identify a previous known-good production deployment in the Cloudflare dashboard for rollback.
- [ ] Tell classmates that camera processing is local to their own browser; no webcam frame upload is part of the inspected browser camera pipeline.

## Troubleshooting decision tree

**Build fails:** check the Cloudflare build log for Node version, `npm ci`, `prebuild`, MediaPipe model download or 25 MiB asset limit. Reproduce only the failed command; do not redesign hosting.

**Blank login page:** check browser console for `createClient` invalid URL/key; verify all Supabase public build variables, then **redeploy**, because Vite embeds values during the build.

**Camera unavailable:** confirm HTTPS, browser permission, compatible media APIs and worker runtime. Test `/pose-worker.js` and `/pose/` assets; if an asset request returns HTML instead of JS/WASM/model bytes, fix the asset path/deployment.

**Supabase login fails:** check auth configuration, domain, schema/policies and whether that exact Supabase project is accessible. Do not create replacement projects or change RLS to public for convenience.

**AI Diet chat fails:** known backend limitation; don't waste time debugging Cloudflare Pages as if it runs FastAPI.

**New main merge breaks production:** in Cloudflare Pages > Deployments select a previously working production deployment and use Rollback. If auto-deploy remains enabled, a subsequent `main` push can deploy a new version again.

## Change policy for Codex

Work only on the deployment branch, never push to `main` or create a pull request. No force pushes, no teammate branch edits, no account operations. Keep code and configuration modifications minimal. After each stage report **PASS / FAIL / BLOCKED BY HUMAN LOGIN** with exact command output and no invented success claims.
