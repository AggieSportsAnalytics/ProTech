const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");

let client = null;

let warnedAnonCache = false;

function getSupabase() {
	if (client) return client;
	const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	const key =
		serviceKey ||
		process.env.VITE_SUPABASE_ANON_KEY ||
		process.env.SUPABASE_ANON_KEY;
	if (!url || !key) return null;
	if (!serviceKey && !warnedAnonCache) {
		warnedAnonCache = true;
		console.warn(
			"SUPABASE_SERVICE_ROLE_KEY not set — overview cache writes may fail (RLS). Add service role key from Supabase → Project Settings → API.",
		);
	}
	client = createClient(url, key, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
		realtime: {
			transport: WebSocket,
		},
	});
	return client;
}

async function getCachedOverview(athleteId, contextHash) {
	const supabase = getSupabase();
	if (!supabase) return null;

	const { data, error } = await supabase
		.from("player_overviews")
		.select("overview, context_hash, generated_at, model")
		.eq("athlete_id", athleteId)
		.maybeSingle();

	if (error) {
		// Table may not exist yet — treat as cache miss
		if (error.code === "42P01" || error.message?.includes("does not exist")) {
			return null;
		}
		console.warn("Cache read error:", error.message);
		return null;
	}

	if (!data || data.context_hash !== contextHash) return null;
	return data;
}

async function saveCachedOverview(athleteId, contextHash, overview, model) {
	const supabase = getSupabase();
	if (!supabase) return;

	const { error } = await supabase.from("player_overviews").upsert(
		{
			athlete_id: athleteId,
			overview,
			context_hash: contextHash,
			model,
			generated_at: new Date().toISOString(),
		},
		{ onConflict: "athlete_id" },
	);

	if (error) {
		console.warn("Cache write error:", error.message);
	}
}

module.exports = { getCachedOverview, saveCachedOverview };
