const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const xlsx = require("xlsx");
const { loadEnv } = require("./lib/loadEnv");
const { generateOverview } = require("./lib/generateOverview");
const { getSupabase, getCachedOverview, saveCachedOverview } = require("./lib/supabase");
const {
	processAthletePhotoUpload,
	isValidUuid,
	parseYear,
} = require("./lib/uploadAthletePhoto");

loadEnv();

const app = express();
const PORT = process.env.PORT || 5000;

const corsOrigins = [
	process.env.FRONTEND_URL,
	"http://localhost:5173",
	"http://127.0.0.1:5173",
].filter(Boolean);

app.use(
	cors({
		origin: corsOrigins.length > 0 ? corsOrigins : true,
	}),
);
app.use(express.json({ limit: "2mb" }));
app.use(
	fileUpload({
		limits: { fileSize: 25 * 1024 * 1024 },
		abortOnLimit: true,
	}),
);

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

/**
 * Upload uncropped athlete photo: server crops with pose model, stores {year}.jpg,
 * archives previous file to old{year}.jpg when present.
 */
app.post("/api/athlete-photo", async (req, res) => {
	try {
		const file = req.files?.photo;
		const athleteId = req.body?.athleteId;
		const year = parseYear(req.body?.year);

		if (!file) {
			return res.status(400).json({ message: "No photo uploaded (field name: photo)" });
		}
		if (!athleteId) {
			return res.status(400).json({ message: "athleteId is required" });
		}
		if (!isValidUuid(athleteId)) {
			return res.status(400).json({ message: "Invalid athleteId" });
		}
		if (year == null) {
			return res.status(400).json({ message: "year must be a number between 2000 and 2100" });
		}

		const supabase = getSupabase();
		if (!supabase) {
			return res.status(503).json({
				message:
					"Server is not configured for storage (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).",
			});
		}

		try {
			await processAthletePhotoUpload(supabase, athleteId, year, file.data);
		} catch (err) {
			if (err.code === "CROP_NO_POSE" || err.code === "CROP_INSUFFICIENT_KEYPOINTS") {
				return res.status(422).json({
					message:
						"We couldn't find a full person in this image. Try a clearer full-body photo.",
				});
			}
			if (err.code === "CROP_BAD_IMAGE") {
				return res.status(400).json({ message: err.message || "Invalid image file" });
			}
			if (err.code === "PLAYER_NOT_FOUND" || err.status === 404) {
				return res.status(404).json({ message: "Player not found" });
			}
			if (err.code === "STORAGE_ARCHIVE_FAILED" || err.code === "STORAGE_UPLOAD_FAILED") {
				console.error("athlete-photo storage:", err);
				return res.status(500).json({ message: err.message || "Storage error" });
			}
			throw err;
		}

		return res.json({ ok: true, year });
	} catch (err) {
		console.error("athlete-photo error:", err);
		return res.status(500).json({ message: err.message || "Failed to process photo" });
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

app.listen(PORT, "0.0.0.0", () => {
	console.log(`Server running on port ${PORT}`);
});
