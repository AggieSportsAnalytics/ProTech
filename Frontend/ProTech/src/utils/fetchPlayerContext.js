import supabase from "./supabase";
import { formatNameFirstLast } from "./nameFormat";

/**
 * Loads all performance data for one athlete from Supabase in parallel.
 */
export async function fetchPlayerContext(athleteId, dataTable = "Athlete_Data") {
	if (!athleteId) return null;

	const [
		profileRes,
		nameRes,
		nordRes,
		baselineRes,
		weeklyRes,
	] = await Promise.all([
		supabase.from(dataTable).select("*").eq("id", athleteId).single(),
		supabase.from("names").select("name").eq("id", athleteId).single(),
		supabase.from("NordBoard").select("*").eq("id", athleteId).order("date", { ascending: true }),
		supabase.from("ForcePlate_Baseline").select("*").eq("id", athleteId).order("date", { ascending: true }),
		supabase.from("ForcePlate_Weekly").select("*").eq("id", athleteId).order("date", { ascending: true }),
	]);

	if (profileRes.error) {
		console.error("fetchPlayerContext profile error:", profileRes.error);
		return null;
	}

	const profile = profileRes.data;
	const position = profile?.position;

	let positionPeersStats = [];
	if (position) {
		const { data: peers } = await supabase
			.from(dataTable)
			.select("stats")
			.eq("position", position);
		positionPeersStats = (peers || []).map((p) => p.stats);
	}

	const displayName =
		formatNameFirstLast(nameRes.data?.name || profile.name) || profile.name;

	return {
		athleteId,
		name: displayName,
		profile,
		nordBoard: nordRes.data || [],
		forcePlateBaseline: baselineRes.data || [],
		forcePlateWeekly: weeklyRes.data || [],
		positionPeersStats,
		positionAverages: Boolean(position),
	};
}
