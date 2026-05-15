const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const xlsx = require("xlsx");
const { loadEnv } = require("./lib/loadEnv");
const { generateOverview } = require("./lib/generateOverview");
const { getCachedOverview, saveCachedOverview } = require("./lib/supabase");

loadEnv();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(fileUpload());

app.get("/api/health", (_req, res) => {
	res.json({ ok: true });
});

/**
 * Generate an AI-written player overview from pre-computed analytics.
 * Frontend fetches Supabase data and runs trend analysis; this route only calls the LLM.
 */
app.post("/api/player-overview", async (req, res) => {
	try {
		const { athleteId, analytics, contextHash, skipCache } = req.body || {};

		if (!analytics || !athleteId) {
			return res.status(400).json({
				message: "athleteId and analytics are required",
			});
		}

		if (!skipCache && contextHash) {
			try {
				const cached = await getCachedOverview(athleteId, contextHash);
				if (cached) {
					return res.json({
						overview: cached.overview,
						cached: true,
						generatedAt: cached.generated_at,
						model: cached.model,
					});
				}
			} catch (cacheErr) {
				console.warn("Cache read skipped:", cacheErr.message);
			}
		}

		const { overview, model } = await generateOverview(analytics);

		if (contextHash) {
			try {
				await saveCachedOverview(athleteId, contextHash, overview, model);
			} catch (cacheErr) {
				console.warn("Cache write skipped:", cacheErr.message);
			}
		}

		res.json({
			overview,
			cached: false,
			generatedAt: new Date().toISOString(),
			model,
		});
	} catch (err) {
		console.error("player-overview error:", err);
		res.status(500).json({ message: err.message || "Failed to generate overview" });
	}
});

app.post("/upload", async (req, res) => {
	try {
		const uploadedFile = req.files?.file;

		if (!uploadedFile) {
			return res.status(400).json({ message: "No file uploaded" });
		}

		const isSupportedFile =
			uploadedFile.name.endsWith(".csv") ||
			uploadedFile.name.endsWith(".xlsx") ||
			uploadedFile.name.endsWith(".xls");

		if (!isSupportedFile) {
			return res.status(400).json({ message: "Only CSV, XLS, or XLSX files are allowed" });
		}

		const workbook = xlsx.read(uploadedFile.data, { type: "buffer" });
		const sheetName = workbook.SheetNames[0];
		const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

		res.json({ data });
	} catch (err) {
		console.error("Error:", err);
		res.status(500).json({ message: "Server error", error: err.message });
	}
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
