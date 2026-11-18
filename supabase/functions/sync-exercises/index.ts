// Supabase Edge Function: sync-exercises
//
// Imports yuhonas/free-exercise-db into public.exercises.
//
//   POST /sync-exercises                       -> sync the catalog (idempotent; unchanged rows are skipped)
//   POST /sync-exercises {"mode":"images"}     -> optional: mirror photos into the exercise-images bucket,
//                                                 `limit` exercises per call; repeat with {"after": <next>} until next is null
//
// Auth: send header  x-sync-secret: <SYNC_SECRET>.  Deploy with --no-verify-jwt (see README).
// Only source-owned columns are written, so your own columns (guide_key, tracker_name, summary,
// is_active, ...) are never overwritten. Custom rows are never touched, even on a slug clash.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SOURCE = "free-exercise-db";
const FEED_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const BUCKET = "exercise-images";

interface SourceExercise {
  id: string;
  name: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string | null;
  images: string[];
}

const LEVELS: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", expert: "Advanced" };
const LEG_MUSCLES = new Set(["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"]);

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function movementOf(e: SourceExercise): string {
  const primary = e.primaryMuscles?.[0];
  if (primary && LEG_MUSCLES.has(primary)) return "Legs";
  if (primary === "abdominals" || primary === "lower back") return "Core";
  if (e.force === "push") return "Push";
  if (e.force === "pull") return "Pull";
  return "Other";
}

function toRow(e: SourceExercise) {
  const equipment = !e.equipment || e.equipment === "body only" ? [] : [titleCase(e.equipment)];
  return {
    name: e.name,
    category: e.category,
    movement: movementOf(e),
    level: e.level ? LEVELS[e.level] ?? null : null,
    force_type: e.force,
    mechanic: e.mechanic,
    equipment,
    primary_muscles: (e.primaryMuscles ?? []).map(titleCase),
    secondary_muscles: (e.secondaryMuscles ?? []).map(titleCase),
    instructions: e.instructions ?? [],
    source_images: e.images ?? [],
  };
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const chunks = <T>(arr: T[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

// deno-lint-ignore no-explicit-any
async function fetchAll(build: (from: number, to: number) => any) {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

async function syncCatalog(supabase: SupabaseClient) {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`Feed request failed: ${res.status}`);
  const feed: SourceExercise[] = await res.json();

  const existing = await fetchAll((from, to) =>
    supabase.from("exercises").select("slug, source, source_hash, deprecated").order("slug").range(from, to)
  );
  const bySlug = new Map<string, { source: string; source_hash: string | null; deprecated: boolean }>(
    existing.map((r) => [r.slug, r]),
  );

  const upserts: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let unchanged = 0, added = 0, updated = 0, skippedCustom = 0;

  for (const item of feed) {
    seen.add(item.id);
    const current = bySlug.get(item.id);
    if (current && current.source !== SOURCE) { skippedCustom++; continue; }

    const fields = toRow(item);
    const hash = await sha256(JSON.stringify(fields));
    if (current && current.source_hash === hash && !current.deprecated) { unchanged++; continue; }

    current ? updated++ : added++;
    upserts.push({
      slug: item.id,
      source: SOURCE,
      source_hash: hash,
      deprecated: false,
      ...fields,
      // Every row in a bulk upsert must carry the same keys (missing ones are sent as null).
      // New and changed rows both start with no mirrored photos; the images job fills them in.
      mirrored_images: [],
      updated_at: new Date().toISOString(),
    });
  }

  for (const chunk of chunks(upserts, 200)) {
    const { error } = await supabase.from("exercises").upsert(chunk, { onConflict: "slug" });
    if (error) throw error;
  }

  // Exercises that vanished upstream are flagged, never deleted (logged sets and plans may point at them).
  const gone = existing.filter((r) => r.source === SOURCE && !r.deprecated && !seen.has(r.slug)).map((r) => r.slug);
  for (const chunk of chunks(gone, 200)) {
    const { error } = await supabase.from("exercises").update({ deprecated: true }).in("slug", chunk);
    if (error) throw error;
  }

  return { feed: feed.length, added, updated, unchanged, deprecated: gone.length, skippedCustom };
}

async function mirrorImages(supabase: SupabaseClient, body: { limit?: number; after?: string }) {
  const limit = Math.min(Math.max(body.limit ?? 20, 1), 50);
  const { data: rows, error } = await supabase
    .from("exercises")
    .select("slug, source_images")
    .eq("source", SOURCE)
    .eq("deprecated", false)
    .eq("mirrored_images", "{}")
    .not("source_images", "eq", "{}")
    .gt("slug", body.after ?? "")
    .order("slug")
    .limit(limit);
  if (error) throw error;

  let processed = 0;
  const failed: string[] = [];

  for (const row of rows) {
    try {
      const urls: string[] = [];
      for (const path of row.source_images as string[]) {
        const img = await fetch(IMAGE_BASE + path.split("/").map(encodeURIComponent).join("/"));
        if (!img.ok) throw new Error(`${img.status} for ${path}`);
        const bytes = new Uint8Array(await img.arrayBuffer());
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
          contentType: img.headers.get("content-type") ?? "image/jpeg",
          upsert: true,
        });
        if (upErr) throw upErr;
        urls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      }
      const { error: updErr } = await supabase.from("exercises").update({ mirrored_images: urls }).eq("slug", row.slug);
      if (updErr) throw updErr;
      processed++;
    } catch (_e) {
      failed.push(row.slug);
    }
  }

  const next = rows.length === limit ? rows[rows.length - 1].slug : null;
  return { processed, failed, next };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret) return json({ error: "SYNC_SECRET is not configured" }, 500);
  if (req.headers.get("x-sync-secret") !== secret) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    return json(body.mode === "images" ? await mirrorImages(supabase, body) : await syncCatalog(supabase));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
