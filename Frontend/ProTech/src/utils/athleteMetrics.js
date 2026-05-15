/**
 * Shared metric parsing and trend analysis for combine, NordBoard, and force plate data.
 */

export const COMBINE_METRICS = [
	{ key: "hangClean", label: "Hang Clean", unit: "lbs", higherIsBetter: true },
	{ key: "backSquat", label: "Back Squat", unit: "lbs", higherIsBetter: true },
	{ key: "inclineBench", label: "Incline Bench", unit: "lbs", higherIsBetter: true },
	{ key: "verticalJump", label: "Vertical Jump", unit: "in", higherIsBetter: true },
	{ key: "broadJump", label: "Broad Jump", unit: "ft", higherIsBetter: true },
	{ key: "bodyWeight", label: "Body Weight", unit: "lbs", higherIsBetter: null },
	{ key: "tenYard", label: "10-Yard", unit: "s", higherIsBetter: false },
	{ key: "flyingTen", label: "Flying 10", unit: "s", higherIsBetter: false },
	{ key: "fortyYard", label: "40-Yard", unit: "s", higherIsBetter: false },
	{ key: "twentyYard", label: "20-Yard", unit: "s", higherIsBetter: false },
	{ key: "laser20", label: "Laser 20", unit: "s", higherIsBetter: false },
	{ key: "proAgility", label: "Pro Agility", unit: "s", higherIsBetter: false },
	{ key: "lDrill", label: "L-Drill", unit: "s", higherIsBetter: false },
	{ key: "nflShuttle", label: "NFL Shuttle", unit: "s", higherIsBetter: false },
];

const UNIT_SUFFIXES = [" lbs", "lbs", " in", "in", " ft", "ft", "s", '"'];

/** Round to hundredths (2 decimal places). */
export function round2(n) {
	if (n == null || !Number.isFinite(n)) return null;
	return Math.round(n * 100) / 100;
}

export function parseNumber(str, unit = "") {
	if (str === null || str === undefined) return null;
	const strValue = typeof str === "string" ? str : String(str);
	if (strValue === "NT" || strValue === "N/A" || strValue.trim() === "") return null;
	let cleaned = strValue;
	if (unit) cleaned = cleaned.replace(unit, "");
	for (const suffix of UNIT_SUFFIXES) {
		cleaned = cleaned.replace(new RegExp(`${suffix}$`, "i"), "");
	}
	cleaned = cleaned.replace(/["']/g, "").trim();
	const num = Number.parseFloat(cleaned);
	return Number.isFinite(num) ? num : null;
}

export function parseMetricValue(raw, metric) {
	if (raw === null || raw === undefined) return null;
	return parseNumber(raw, metric.unit);
}

function dedupeStatsByYear(stats) {
	if (!Array.isArray(stats)) return [];
	const byYear = new Map();
	for (const entry of stats) {
		if (!entry?.year) continue;
		const year = Number(entry.year);
		if (!Number.isFinite(year)) continue;
		const existing = byYear.get(year);
		if (!existing) {
			byYear.set(year, entry);
			continue;
		}
		const existingCount = Object.values(existing).filter((v) => v != null && v !== "NT").length;
		const currentCount = Object.values(entry).filter((v) => v != null && v !== "NT").length;
		if (currentCount > existingCount) byYear.set(year, entry);
	}
	return [...byYear.values()].sort((a, b) => a.year - b.year);
}

const GAP_DAYS_THRESHOLD = 21; // more than 3 weeks

/** Gaps between consecutive session dates longer than 3 weeks. */
export function findCalendarGaps(dates) {
	if (!dates?.length) return [];
	const sorted = [...dates]
		.filter(Boolean)
		.sort((a, b) => new Date(a) - new Date(b));
	const gaps = [];
	for (let i = 1; i < sorted.length; i++) {
		const prev = new Date(sorted[i - 1]);
		const curr = new Date(sorted[i]);
		const days = (curr - prev) / (1000 * 60 * 60 * 24);
		if (days > GAP_DAYS_THRESHOLD) {
			gaps.push({
				from: sorted[i - 1],
				to: sorted[i],
				gapDays: round2(days),
				gapWeeks: round2(days / 7),
			});
		}
	}
	return gaps;
}

/**
 * Combine gap: movement tested in only one year (or never) while missing 2+ years
 * on the athlete's record. Notable if more than 3 movements qualify.
 */
export function analyzeCombineDataGaps(stats) {
	const yearly = dedupeStatsByYear(stats);
	const combineYearsOnRecord = yearly.map((e) => e.year);
	const sparseMetrics = [];

	if (combineYearsOnRecord.length < 3) {
		return { notable: false, sparseMetrics, combineYearsOnRecord, reason: "fewer_than_3_years" };
	}

	for (const metric of COMBINE_METRICS) {
		if (metric.higherIsBetter == null) continue;

		const yearsWithData = [];
		const yearsMissing = [];

		for (const entry of yearly) {
			const val = parseMetricValue(entry[metric.key], metric);
			if (val != null) yearsWithData.push(entry.year);
			else yearsMissing.push(entry.year);
		}

		if (yearsWithData.length <= 1 && yearsMissing.length >= 2) {
			sparseMetrics.push({
				metric: metric.label,
				testedYear: yearsWithData[0] ?? null,
				missingYears: yearsMissing,
				neverTested: yearsWithData.length === 0,
			});
		}
	}

	return {
		notable: sparseMetrics.length > 3,
		sparseMetrics,
		combineYearsOnRecord,
	};
}

function improvementScore(start, end, higherIsBetter) {
	if (start == null || end == null || start === 0) return null;
	if (higherIsBetter === true) return ((end - start) / start) * 100;
	if (higherIsBetter === false) return ((start - end) / start) * 100;
	return null;
}

function formatDelta(start, end, metric) {
	if (start == null || end == null) return null;
	const diff = round2(end - start);
	const sign = diff > 0 ? "+" : "";
	if (metric.unit === "s") return `${sign}${diff}s`;
	if (metric.unit === "lbs") return `${sign}${Math.round(diff)} lbs`;
	if (metric.unit === "in") return `${sign}${diff} in`;
	if (metric.unit === "ft") return `${sign}${diff} ft`;
	return `${sign}${diff}`;
}

function formatMetricValue(value, unit) {
	if (value == null) return null;
	const v = round2(value);
	if (unit === "s") return `${v}s`;
	if (unit === "lbs") return `${v} lbs`;
	if (unit === "in") return `${v} in`;
	if (unit === "ft") return `${v} ft`;
	return String(v);
}

export function analyzeCombineTrends(stats) {
	const yearly = dedupeStatsByYear(stats);
	const trends = [];
	const improvements = [];
	const stagnations = [];

	for (const metric of COMBINE_METRICS) {
		const series = yearly
			.map((entry) => {
				const value = parseMetricValue(entry[metric.key], metric);
				return {
					year: entry.year,
					value: value != null ? round2(value) : null,
					display: value != null ? formatMetricValue(value, metric.unit) : null,
				};
			})
			.filter((row) => row.value != null);

		if (series.length === 0) continue;

		const first = series[0];
		const last = series[series.length - 1];
		const score = improvementScore(first.value, last.value, metric.higherIsBetter);

		const yoy = [];
		for (let i = 1; i < series.length; i++) {
			const prev = series[i - 1];
			const curr = series[i];
			const pct = improvementScore(prev.value, curr.value, metric.higherIsBetter);
			yoy.push({
				fromYear: prev.year,
				toYear: curr.year,
				from: prev.value,
				to: curr.value,
				fromDisplay: prev.display,
				toDisplay: curr.display,
				delta: formatDelta(prev.value, curr.value, metric),
				improvementPct: pct != null ? round2(pct) : null,
			});
		}

		const trend = {
			metric: metric.key,
			label: metric.label,
			unit: metric.unit,
			higherIsBetter: metric.higherIsBetter,
			series,
			careerStart: { year: first.year, value: first.value, display: first.display },
			careerLatest: { year: last.year, value: last.value, display: last.display },
			careerDelta: formatDelta(first.value, last.value, metric),
			careerImprovementPct: score != null ? round2(score) : null,
			yearOverYear: yoy,
		};
		trends.push(trend);

		if (score != null && metric.higherIsBetter != null && score > 1) {
			improvements.push({ ...trend, improvementPct: score });
		}

		if (series.length >= 2 && metric.higherIsBetter != null) {
			const lastTwo = series.slice(-2);
			const recentScore = improvementScore(
				lastTwo[0].value,
				lastTwo[1].value,
				metric.higherIsBetter,
			);
			if (recentScore != null && Math.abs(recentScore) < 1.5) {
				stagnations.push({
					metric: metric.key,
					label: metric.label,
					years: [lastTwo[0].year, lastTwo[1].year],
					value: lastTwo[0].display,
					improvementPct: round2(recentScore),
				});
			}
		}
	}

	improvements.sort((a, b) => b.improvementPct - a.improvementPct);

	return {
		yearsTested: yearly.map((e) => e.year),
		trends,
		mostImproved: improvements.slice(0, 5),
		stagnant: stagnations,
	};
}

export function analyzeNordBoard(rows) {
	if (!rows?.length) return null;
	const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));
	const first = sorted[0];
	const last = sorted[sorted.length - 1];

	const avgForce = (row) => {
		const l = Number(row.L_max_force_n) || 0;
		const r = Number(row.R_max_force_n) || 0;
		return (l + r) / 2;
	};

	const sessionDates = sorted.map((r) => r.date).filter(Boolean);
	const calendarGaps = findCalendarGaps(sessionDates);
	const firstImbalance = round2(Number(first.max_imbalance_percent));
	const lastImbalance = round2(Number(last.max_imbalance_percent));

	return {
		sessionCount: sorted.length,
		sessionDates,
		calendarGaps,
		hasNotableCalendarGap: calendarGaps.length > 0,
		firstSession: {
			date: first.date,
			avgForceN: round2(avgForce(first)),
			imbalancePct: firstImbalance,
		},
		latestSession: {
			date: last.date,
			avgForceN: round2(avgForce(last)),
			imbalancePct: lastImbalance,
		},
		forceDeltaN: round2(avgForce(last) - avgForce(first)),
		imbalanceLatest: lastImbalance,
	};
}

export function analyzeForcePlate(baselineRows, weeklyRows) {
	const all = [...(baselineRows || []), ...(weeklyRows || [])];
	if (!all.length) return null;

	const sorted = [...all].sort((a, b) => new Date(a.date) - new Date(b.date));
	const first = sorted[0];
	const last = sorted[sorted.length - 1];

	const num = (v) => (v == null || v === "" ? null : Number(v));
	const sessionDates = sorted.map((r) => r.date).filter(Boolean);
	const calendarGaps = findCalendarGaps(sessionDates);

	return {
		sessionCount: sorted.length,
		sessionDates,
		calendarGaps,
		hasNotableCalendarGap: calendarGaps.length > 0,
		firstSession: {
			date: first.date,
			rsi: round2(num(first.rsi_modified_meters_sec)),
			jumpHeightCm: round2(num(first.jump_height_cm)),
		},
		latestSession: {
			date: last.date,
			rsi: round2(num(last.rsi_modified_meters_sec)),
			jumpHeightCm: round2(num(last.jump_height_cm)),
		},
		latestAsymmetry: {
			concentricL: round2(num(last.concentric_impulse_asym_percent_L)),
			concentricR: round2(num(last.concentric_impulse_asym_percent_R)),
			eccentricL: round2(num(last.eccentric_deceleration_impulse_asym_percent_L)),
			eccentricR: round2(num(last.eccentric_deceleration_impulse_asym_percent_R)),
			landingL: round2(num(last.landing_impulse_asym_percent_L)),
			landingR: round2(num(last.landing_impulse_asym_percent_R)),
		},
	};
}

export function getLatestStats(stats) {
	const statKeys = COMBINE_METRICS.map((m) => m.key);
	const sorted = [...(stats || [])].sort((a, b) => b.year - a.year);
	const latestStats = {};
	for (const key of statKeys) {
		for (const entry of sorted) {
			const value = entry[key];
			if (value && value !== "NT") {
				latestStats[key] = value;
				break;
			}
		}
	}
	return latestStats;
}

export function calcPositionAverages(athletesStats, position) {
	const peers = athletesStats.filter(Boolean);
	const averages = {};

	for (const metric of COMBINE_METRICS) {
		if (metric.higherIsBetter == null) continue;
		const values = peers
			.map((stats) => {
				const latest = getLatestStats(stats);
				return parseMetricValue(latest[metric.key], metric);
			})
			.filter((v) => v != null && v > 0);

		if (values.length) {
			averages[metric.key] = round2(
				values.reduce((a, b) => a + b, 0) / values.length,
			);
		}
	}

	return { position, averages, peerCount: peers.length };
}

function firstNameFrom(fullName) {
	if (!fullName) return "The athlete";
	const parts = String(fullName).trim().split(/\s+/);
	return parts[0] || fullName;
}

function buildDataGaps(stats, nordBoard, forcePlate) {
	const combine = analyzeCombineDataGaps(stats);
	const nordGaps = nordBoard?.calendarGaps || [];
	const fpGaps = forcePlate?.calendarGaps || [];

	return {
		combine,
		nordBoard: { notable: nordGaps.length > 0, gaps: nordGaps },
		forcePlate: { notable: fpGaps.length > 0, gaps: fpGaps },
		anyNotable:
			combine.notable || nordGaps.length > 0 || fpGaps.length > 0,
	};
}

function buildInsights({ name, combine, nordBoard, forcePlate, positionComparison, profile, dataGaps }) {
	const firstName = firstNameFrom(name);
	const improvements = [];
	const areasToWatch = [];
	const testingNotes = [];
	const latest = getLatestStats(profile?.stats || []);

	if (dataGaps?.combine?.notable) {
		const labels = dataGaps.combine.sparseMetrics.map((m) => m.metric).join(", ");
		const years = dataGaps.combine.combineYearsOnRecord.join(", ");
		testingNotes.push(
			`${firstName} has a notable gap in combine data: more than 3 movements (${labels}) have results in only one year (or none) on record across ${years}, while missing at least two other years for each.`,
		);
	} else if (dataGaps?.combine?.sparseMetrics?.length > 0) {
		const labels = dataGaps.combine.sparseMetrics.map((m) => m.metric).join(", ");
		testingNotes.push(
			`${firstName} has incomplete combine data for ${labels} (only one year or untested across multiple years on record), but this does not meet the threshold for a notable combine gap.`,
		);
	}

	for (const g of dataGaps?.nordBoard?.gaps || []) {
		testingNotes.push(
			`${firstName} has a notable NordBord testing gap: no sessions for ${g.gapWeeks} weeks between ${g.from} and ${g.to}.`,
		);
	}

	for (const g of dataGaps?.forcePlate?.gaps || []) {
		testingNotes.push(
			`${firstName} has a notable force plate testing gap: no sessions for ${g.gapWeeks} weeks between ${g.from} and ${g.to}.`,
		);
	}

	if (!dataGaps?.anyNotable && (dataGaps?.combine?.combineYearsOnRecord?.length || 0) >= 2) {
		testingNotes.push(
			`${firstName}'s combine and in-season testing coverage is reasonably complete with no notable calendar or multi-year gaps detected.`,
		);
	}

	for (const s of combine?.stagnant || []) {
		const yr = s.years?.join(" and ");
		areasToWatch.push(
			`${firstName}'s ${s.label} stagnated between ${yr}, holding at ${s.value}, which may suggest a training plateau in that quality.`,
		);
	}

	for (const t of combine?.trends || []) {
		if (t.careerImprovementPct != null && t.careerImprovementPct < -1) {
			areasToWatch.push(
				`${firstName}'s ${t.label} declined from ${t.careerStart?.display} (${t.careerStart?.year}) to ${t.careerLatest?.display} (${t.careerLatest?.year}), which may indicate lost ${t.higherIsBetter ? "strength or power" : "speed or agility"}.`,
			);
		}
		const lastYoy = t.yearOverYear?.[t.yearOverYear.length - 1];
		if (lastYoy?.improvementPct != null && lastYoy.improvementPct < -1) {
			areasToWatch.push(
				`${firstName}'s ${t.label} regressed from ${lastYoy.fromDisplay} in ${lastYoy.fromYear} to ${lastYoy.toDisplay} in ${lastYoy.toYear}, which may warrant a look at recovery or program emphasis.`,
			);
		}
	}

	if (positionComparison?.averages) {
		for (const metric of COMBINE_METRICS) {
			if (metric.higherIsBetter == null) continue;
			const playerVal = parseMetricValue(latest[metric.key], metric);
			const avg = positionComparison.averages[metric.key];
			if (playerVal == null || avg == null) continue;

			const fasterOrHigher = metric.higherIsBetter ? playerVal > avg : playerVal < avg;
			if (!fasterOrHigher) {
				const comparison = metric.higherIsBetter ? "below" : "slower than";
				areasToWatch.push(
					`${firstName}'s latest ${metric.label} is ${formatMetricValue(playerVal, metric.unit)}, ${comparison} the position average of ${formatMetricValue(avg, metric.unit)}, which may limit on-field explosiveness or speed.`,
				);
			} else {
				const comparison = metric.higherIsBetter ? "above" : "faster than";
				improvements.push(
					`${firstName}'s latest ${metric.label} is ${formatMetricValue(playerVal, metric.unit)}, ${comparison} the position average of ${formatMetricValue(avg, metric.unit)}.`,
				);
			}
		}
	}

	if (nordBoard?.firstSession?.imbalancePct != null && nordBoard?.latestSession?.imbalancePct != null) {
		const from = nordBoard.firstSession.imbalancePct;
		const to = nordBoard.latestSession.imbalancePct;
		if (to > from) {
			areasToWatch.push(
				`${firstName}'s hamstring imbalance increased from ${from}% to ${to}%, which may raise injury risk if it continues.`,
			);
		} else if (to < from) {
			improvements.push(
				`${firstName}'s hamstring imbalance decreased from ${from}% to ${to}%, indicating better hamstring balance.`,
			);
		}
	}

	if (nordBoard?.forceDeltaN != null && nordBoard.forceDeltaN < 0) {
		areasToWatch.push(
			`${firstName}'s average NordBord force dropped by ${Math.abs(nordBoard.forceDeltaN)} N from first to latest test, which may reflect hamstring deconditioning.`,
		);
	} else if (nordBoard?.forceDeltaN != null && nordBoard.forceDeltaN > 0) {
		improvements.push(
			`${firstName}'s average NordBord force rose by ${nordBoard.forceDeltaN} N from first to latest test.`,
		);
	}

	if (forcePlate?.firstSession?.rsi != null && forcePlate?.latestSession?.rsi != null) {
		const from = forcePlate.firstSession.rsi;
		const to = forcePlate.latestSession.rsi;
		if (to < from) {
			areasToWatch.push(
				`${firstName}'s force plate RSI decreased from ${from} to ${to}, suggesting a possible drop in reactive strength.`,
			);
		} else if (to > from) {
			improvements.push(
				`${firstName}'s force plate RSI increased from ${from} to ${to}, suggesting improved explosive power.`,
			);
		}
	}

	const jFrom = forcePlate?.firstSession?.jumpHeightCm;
	const jTo = forcePlate?.latestSession?.jumpHeightCm;
	if (jFrom != null && jTo != null && jTo < jFrom) {
		areasToWatch.push(
			`${firstName}'s jump height fell from ${jFrom} cm to ${jTo} cm across force plate sessions, which may point to reduced lower-body power.`,
		);
	} else if (jFrom != null && jTo != null && jTo > jFrom) {
		improvements.push(
			`${firstName}'s jump height rose from ${jFrom} cm to ${jTo} cm across force plate sessions.`,
		);
	}

	for (const t of combine?.mostImproved?.slice(0, 3) || []) {
		if (t.careerImprovementPct == null || t.yearOverYear?.length === 0) continue;
		const yoy = t.yearOverYear[t.yearOverYear.length - 1];
		if (yoy.improvementPct == null || yoy.improvementPct <= 0) continue;
		improvements.push(
			`${firstName}'s ${t.label} improved ${yoy.improvementPct}% from ${yoy.fromDisplay} in ${yoy.fromYear} to ${yoy.toDisplay} in ${yoy.toYear}.`,
		);
	}

	return { improvements, areasToWatch, testingNotes };
}

export function buildPlayerAnalytics(context) {
	const combine = analyzeCombineTrends(context.profile?.stats);
	const nord = analyzeNordBoard(context.nordBoard);
	const forcePlate = analyzeForcePlate(context.forcePlateBaseline, context.forcePlateWeekly);
	const positionComparison = context.positionAverages
		? calcPositionAverages(
				context.positionPeersStats || [],
				context.profile?.position,
			)
		: null;

	const dataGaps = buildDataGaps(context.profile?.stats, nord, forcePlate);

	const base = {
		athleteId: context.athleteId,
		name: context.name,
		firstName: firstNameFrom(context.name),
		position: context.profile?.position,
		height: context.profile?.height,
		wing: context.profile?.wing,
		hand: context.profile?.hand,
		combine,
		nordBoard: nord,
		forcePlate,
		positionComparison,
		dataGaps,
		generatedFrom: {
			combineYears: combine.yearsTested?.length || 0,
			nordSessions: nord?.sessionCount || 0,
			forcePlateSessions: forcePlate?.sessionCount || 0,
		},
	};

	base.insightSections = buildInsights({ ...base, profile: context.profile, dataGaps });
	return base;
}
