function firstNameFrom(fullName) {
	if (!fullName) return "The athlete";
	const parts = String(fullName).trim().split(/\s+/);
	return parts[0] || fullName;
}

function nordBoardForPrompt(nord) {
	if (!nord) return null;
	return {
		sessionCount: nord.sessionCount,
		imbalanceFirstPct: nord.firstSession?.imbalancePct,
		imbalanceLatestPct: nord.latestSession?.imbalancePct,
		avgForceFirstN: nord.firstSession?.avgForceN,
		avgForceLatestN: nord.latestSession?.avgForceN,
		forceDeltaN: nord.forceDeltaN,
		calendarGapsOver3Weeks: nord.calendarGaps,
		hasNotableCalendarGap: nord.hasNotableCalendarGap,
	};
}

function forcePlateForPrompt(fp) {
	if (!fp) return null;
	return {
		sessionCount: fp.sessionCount,
		rsiFirst: fp.firstSession?.rsi,
		rsiLatest: fp.latestSession?.rsi,
		jumpHeightFirstCm: fp.firstSession?.jumpHeightCm,
		jumpHeightLatestCm: fp.latestSession?.jumpHeightCm,
		latestAsymmetry: fp.latestAsymmetry,
		calendarGapsOver3Weeks: fp.calendarGaps,
		hasNotableCalendarGap: fp.hasNotableCalendarGap,
	};
}

function formatInsightList(items) {
	return items?.length ? items.map((t) => `- ${t}`).join("\n") : "(none)";
}

function buildOverviewPrompt(analytics) {
	const {
		name,
		firstName,
		position,
		combine,
		nordBoard,
		forcePlate,
		positionComparison,
		insightSections,
		dataGaps,
	} = analytics;
	const displayName = firstName || firstNameFrom(name);
	const sections = insightSections || { improvements: [], areasToWatch: [], testingNotes: [] };

	return `You are a strength & conditioning analyst for a college football program. Write a short, clear player overview coaches can scan quickly.

PLAYER: ${name} (${position || "position unknown"})

Use ONLY the data below. Do not invent numbers. All numbers are already rounded to 2 decimal places — use them exactly as given (never write long decimals like 4.626666666666666).

STYLE:
- Simple words. Short sentences. No jargon.
- Add brief reasoning after stagnations or declines (e.g. "which may suggest a training plateau", "which may raise injury risk").

STRUCTURE — use these exact markdown headings:
## ${displayName}'s Biggest Improvements
## ${displayName}'s Areas to Watch
## ${displayName}'s Testing Notes

SECTION RULES (do not mix content across sections):
- The FIRST sentence under each heading MUST start with "${displayName}" or "${displayName}'s".

## Biggest Improvements
- Use ONLY "FOR BIGGEST IMPROVEMENTS" bullets below.
- Year-over-year gains, position strengths, positive NordBord/force plate trends.

## Areas to Watch
- Use ONLY "FOR AREAS TO WATCH" bullets below.
- ONLY stagnations, regressions, or declines in tested metrics (combine, NordBord, force plate).
- Include simple reasoning on what it could mean.
- Do NOT mention missing data, untested years, calendar gaps, or "notable gaps" here — those belong in Testing Notes only.
- If there are no stagnations or declines, write one short sentence that ${displayName} has no major performance declines on record.

## Testing Notes
- Use ONLY "FOR TESTING NOTES" bullets and the DATA GAPS JSON.
- ONLY data coverage: missing combine years, untested movements, NordBord/force plate gaps over 3 weeks.
- Do NOT repeat stagnations or performance declines here.
- If dataGaps.anyNotable is true, describe those gaps — never say testing is complete or consistent.
- If dataGaps.anyNotable is false, you may note coverage is reasonably complete.

DATA GAP RULES (Testing Notes only):
- Combine notable gap: more than 3 movements with only one year (or none) of data while missing 2+ other years on record.
- Calendar notable gap: any NordBord or force plate break longer than 3 weeks (calendarGapsOver3Weeks).

DO NOT WRITE:
- Full session date ranges for entire testing periods
- The same gap or decline in both Areas to Watch and Testing Notes

OK in Testing Notes: specific gap windows (e.g. "no NordBord tests for 4 weeks between July 24 and Aug 21").

Keep the full response under 450 words.

FOR BIGGEST IMPROVEMENTS:
${formatInsightList(sections.improvements)}

FOR AREAS TO WATCH:
${formatInsightList(sections.areasToWatch)}

FOR TESTING NOTES:
${formatInsightList(sections.testingNotes)}

DATA GAPS (Testing Notes only — authoritative):
${JSON.stringify(dataGaps || {}, null, 2)}

PLAYER DATA (JSON):
${JSON.stringify(
	{
		name,
		position,
		combine: {
			yearsTested: combine?.yearsTested,
			mostImproved: combine?.mostImproved?.map((t) => ({
				metric: t.label,
				improvementPct: t.careerImprovementPct,
				careerDelta: t.careerDelta,
				from: t.careerStart,
				to: t.careerLatest,
				yearOverYear: t.yearOverYear,
			})),
			stagnant: combine?.stagnant,
		},
		nordBoard: nordBoardForPrompt(nordBoard),
		forcePlate: forcePlateForPrompt(forcePlate),
		positionComparison: positionComparison
			? {
					position: positionComparison.position,
					peerCount: positionComparison.peerCount,
					averages: positionComparison.averages,
				}
			: null,
	},
	null,
	2,
)}`;
}

module.exports = { buildOverviewPrompt };
