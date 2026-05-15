const fs = require("fs");
const path = require("path");

function parseEnvFile(filePath) {
	if (!fs.existsSync(filePath)) return {};
	const content = fs.readFileSync(filePath, "utf8");
	const env = {};
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		const value = trimmed.slice(eq + 1).trim();
		if (key) env[key] = value;
	}
	return env;
}

function loadEnv() {
	const candidates = [
		path.join(__dirname, "..", ".env"),
		path.join(__dirname, "..", "..", "Frontend", "ProTech", ".env"),
	];
	for (const filePath of candidates) {
		const parsed = parseEnvFile(filePath);
		for (const [key, value] of Object.entries(parsed)) {
			if (!process.env[key]) process.env[key] = value;
		}
	}
}

module.exports = { loadEnv };
