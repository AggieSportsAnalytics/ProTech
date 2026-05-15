import { useCallback, useEffect, useRef, useState } from "react";
import supabase from "../utils/supabase";
import { fetchPlayerContext } from "../utils/fetchPlayerContext";
import { buildPlayerAnalytics } from "../utils/athleteMetrics";
import { hashAnalytics } from "../utils/hashAnalytics";
import Loader from "./Loader";

const API_BASE = import.meta.env.VITE_API_URL || "";

function renderOverviewMarkdown(text) {
	if (!text) return null;
	return text.split("\n").map((line, i) => {
		if (line.startsWith("## ")) {
			return (
				<h3 key={i} className="text-lg font-semibold text-[#022851] mt-5 mb-2 first:mt-0">
					{line.replace(/^##\s*/, "")}
				</h3>
			);
		}
		if (line.startsWith("### ")) {
			return (
				<h4 key={i} className="text-base font-semibold text-[#022851] mt-3 mb-1">
					{line.replace(/^###\s*/, "")}
				</h4>
			);
		}
		if (line.trim() === "") return <br key={i} />;
		return (
			<p key={i} className="text-gray-700 leading-relaxed mb-2">
				{line}
			</p>
		);
	});
}

function PlayerOverview({ athleteId, dataTable = "Athlete_Data", autoGenerate = true }) {
	const [loading, setLoading] = useState(true);
	const [generating, setGenerating] = useState(false);
	const [overview, setOverview] = useState("");
	const [generatedAt, setGeneratedAt] = useState(null);
	const [cached, setCached] = useState(false);
	const [error, setError] = useState("");
	const [analytics, setAnalytics] = useState(null);
	const [contextHash, setContextHash] = useState(null);
	const [hasData, setHasData] = useState(false);
	const runIdRef = useRef(0);

	const loadAnalytics = useCallback(async () => {
		if (!athleteId) return null;
		const context = await fetchPlayerContext(athleteId, dataTable);
		if (!context) return null;
		const built = buildPlayerAnalytics(context);
		const hash = await hashAnalytics(built);
		const combineYears = built.combine?.yearsTested?.length || 0;
		const nordSessions = built.nordBoard?.sessionCount || 0;
		const fpSessions = built.forcePlate?.sessionCount || 0;
		const dataAvailable = combineYears > 0 || nordSessions > 0 || fpSessions > 0;
		return { built, hash, dataAvailable };
	}, [athleteId, dataTable]);

	const tryLoadFromSupabase = useCallback(
		async (hash) => {
			const { data, error: cacheError } = await supabase
				.from("player_overviews")
				.select("overview, context_hash, generated_at")
				.eq("athlete_id", athleteId)
				.maybeSingle();

			if (cacheError) return false;
			if (data?.overview && data.context_hash === hash) {
				setOverview(data.overview);
				setGeneratedAt(data.generated_at);
				setCached(true);
				return true;
			}
			return false;
		},
		[athleteId],
	);

	const generate = useCallback(
		async (regenerate = false, payload) => {
			const built = payload?.analytics ?? analytics;
			const hash = payload?.contextHash ?? contextHash;
			const runId = payload?.runId ?? runIdRef.current;
			if (!built || !hash) return;

			setGenerating(true);
			setError("");

			try {
				const res = await fetch(`${API_BASE}/api/player-overview`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						athleteId,
						analytics: built,
						contextHash: hash,
						skipCache: regenerate,
					}),
				});

				const body = await res.json();
				if (!res.ok) throw new Error(body.message || "Failed to generate overview");

				if (runId !== runIdRef.current) return;

				setOverview(body.overview);
				setGeneratedAt(body.generatedAt);
				setCached(body.cached);
			} catch (err) {
				if (runId !== runIdRef.current) return;
				setError(err.message || "Failed to generate overview");
			} finally {
				if (runId === runIdRef.current) setGenerating(false);
			}
		},
		[analytics, contextHash, athleteId],
	);

	useEffect(() => {
		const runId = ++runIdRef.current;
		let cancelled = false;

		async function init() {
			setLoading(true);
			setGenerating(false);
			setError("");
			setOverview("");
			setCached(false);
			setAnalytics(null);
			setContextHash(null);

			try {
				const result = await loadAnalytics();
				if (cancelled || runId !== runIdRef.current) return;

				if (!result) {
					setHasData(false);
					return;
				}

				const { built, hash, dataAvailable } = result;
				setAnalytics(built);
				setContextHash(hash);
				setHasData(dataAvailable);

				if (!dataAvailable) return;

				const hit = await tryLoadFromSupabase(hash);
				if (cancelled || runId !== runIdRef.current) return;

				if (!hit && autoGenerate) {
					await generate(false, { analytics: built, contextHash: hash, runId });
				}
			} catch (err) {
				if (!cancelled && runId === runIdRef.current) {
					setError(err.message || "Failed to load player data");
				}
			} finally {
				if (!cancelled && runId === runIdRef.current) setLoading(false);
			}
		}

		init();
		return () => {
			cancelled = true;
		};
		// generate intentionally omitted — payload is passed inline to avoid re-runs when analytics state updates
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [athleteId, loadAnalytics, tryLoadFromSupabase, autoGenerate]);

	if (loading) {
		return (
			<div className="flex justify-center py-12">
				<Loader />
			</div>
		);
	}

	if (!hasData) {
		return (
			<p className="text-gray-500 text-center py-6">
				Not enough performance data yet to generate an overview.
			</p>
		);
	}

	const showLoader = generating && !overview;

	return (
		<div>
			<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
				<div className="text-sm text-gray-500">
					{generating && (
						<span className="text-[#022851]">Generating overview…</span>
					)}
					{!generating && overview && generatedAt && (
						<span>
							{cached ? "Cached" : "Generated"}{" "}
							{new Date(generatedAt).toLocaleDateString(undefined, {
								month: "short",
								day: "numeric",
								year: "numeric",
							})}
						</span>
					)}
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => generate(false)}
						disabled={generating}
						className="px-4 py-2 bg-[#022851] hover:bg-[#033d7a] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
					>
						{generating ? "Generating…" : overview ? "Refresh" : "Generate"}
					</button>
					{overview && (
						<button
							type="button"
							onClick={() => generate(true)}
							disabled={generating}
							className="px-4 py-2 bg-white border border-[#022851]/30 hover:bg-gray-50 text-[#022851] text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
						>
							Regenerate
						</button>
					)}
				</div>
			</div>

			{error && (
				<div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
					{error}
					{(error.includes("API_KEY") || error.includes("LLM_PROVIDER")) && (
						<p className="mt-1 text-red-600">
							Set GROQ_API_KEY in backend/.env, then restart the server.
						</p>
					)}
				</div>
			)}

			{showLoader && (
				<div className="flex justify-center py-8">
					<Loader />
				</div>
			)}

			{overview && !showLoader && (
				<div className="prose prose-sm max-w-none">{renderOverviewMarkdown(overview)}</div>
			)}
		</div>
	);
}

export default PlayerOverview;
