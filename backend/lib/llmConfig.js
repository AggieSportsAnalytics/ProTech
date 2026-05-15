/**
 * OpenAI-compatible LLM providers.
 * Set LLM_PROVIDER in .env (groq | openrouter | deepseek | openai | ollama).
 */
const PROVIDERS = {
	groq: {
		baseUrl: "https://api.groq.com/openai/v1",
		apiKeyEnv: "GROQ_API_KEY",
		defaultModel: "llama-3.3-70b-versatile",
	},
	openrouter: {
		baseUrl: "https://openrouter.ai/api/v1",
		apiKeyEnv: "OPENROUTER_API_KEY",
		defaultModel: "meta-llama/llama-3.3-70b-instruct",
	},
	deepseek: {
		baseUrl: "https://api.deepseek.com",
		apiKeyEnv: "DEEPSEEK_API_KEY",
		defaultModel: "deepseek-chat",
	},
	openai: {
		baseUrl: "https://api.openai.com/v1",
		apiKeyEnv: "OPENAI_API_KEY",
		defaultModel: "gpt-4o-mini",
	},
	ollama: {
		baseUrl: "http://127.0.0.1:11434/v1",
		apiKeyEnv: null,
		defaultModel: "llama3.3",
	},
};

function detectProvider() {
	if (process.env.LLM_PROVIDER) return process.env.LLM_PROVIDER;
	if (process.env.GROQ_API_KEY) return "groq";
	if (process.env.OPENROUTER_API_KEY) return "openrouter";
	if (process.env.DEEPSEEK_API_KEY) return "deepseek";
	if (process.env.OPENAI_API_KEY) return "openai";
	return "groq";
}

function getLlmConfig() {
	const providerName = detectProvider();
	const provider = PROVIDERS[providerName];
	if (!provider) {
		throw new Error(
			`Unknown LLM_PROVIDER "${providerName}". Use: ${Object.keys(PROVIDERS).join(", ")}`,
		);
	}

	const apiKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : "ollama";
	if (provider.apiKeyEnv && !apiKey) {
		throw new Error(
			`${provider.apiKeyEnv} is not set. Add it to backend/.env or Frontend/ProTech/.env`,
		);
	}

	const model = process.env.LLM_MODEL || provider.defaultModel;
	const baseUrl = (process.env.LLM_BASE_URL || provider.baseUrl).replace(/\/$/, "");

	return { providerName, apiKey, model, baseUrl };
}

module.exports = { getLlmConfig, PROVIDERS };
