const { buildOverviewPrompt } = require("./prompt");
const { getLlmConfig } = require("./llmConfig");

async function generateOverview(analytics) {
	const { providerName, apiKey, model, baseUrl } = getLlmConfig();
	const prompt = buildOverviewPrompt(analytics);

	const headers = {
		"Content-Type": "application/json",
	};
	if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
	if (providerName === "openrouter") {
		headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL || "https://protech.local";
		headers["X-Title"] = "ProTech Player Overview";
	}

	const response = await fetch(`${baseUrl}/chat/completions`, {
		method: "POST",
		headers,
		body: JSON.stringify({
			model,
			messages: [
				{
					role: "system",
					content:
						"You write clear, factual athletic performance summaries for football coaches.",
				},
				{ role: "user", content: prompt },
			],
			temperature: 0.4,
			max_tokens: 800,
		}),
	});

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`LLM API error (${response.status}): ${errText}`);
	}

	const data = await response.json();
	const overview = data.choices?.[0]?.message?.content?.trim();
	if (!overview) throw new Error("LLM returned an empty response");

	return { overview, model: `${providerName}:${model}` };
}

module.exports = { generateOverview };
