/**
 * Crop + Supabase upload for athlete progress photos.
 * Path: athlete-images/{sanitizedName-uuid}/{year}.jpg (always JPEG after crop).
 * Replaces prior year assets: any existing `{year}.jpg|png|webp|gif` is JPEG-archived
 * to `old{year}.jpg`, then removed from storage before the new `{year}.jpg` is written.
 */

const sharp = require("sharp");
const { cropPersonFromImageBuffer } = require("./cropFromPose");

const BUCKET = "athlete-images";

/**
 * Primary photo for a season: `{year}.jpg` | `.png` | etc., not `old{year}.*`.
 * @param {string} name
 * @param {number} year
 */
function isPrimaryYearImageFile(name, year) {
	if (!name || /^old\d{4}/i.test(name)) return false;
	return new RegExp(`^${year}\\.(jpe?g|png|webp|gif)$`, "i").test(name);
}

/** Prefer JPG as the file we move to `old{year}.jpg`; then png, webp, gif. */
function sortYearImageFiles(files) {
	const rank = (/** @type {string} */ name) => {
		const ext = name.split(".").pop()?.toLowerCase();
		if (ext === "jpg" || ext === "jpeg") return 0;
		if (ext === "png") return 1;
		if (ext === "webp") return 2;
		if (ext === "gif") return 3;
		return 9;
	};
	return [...files].sort((a, b) => rank(a.name) - rank(b.name));
}

function buildFolderName(displayName, athleteId) {
	const sanitized = String(displayName).replace(/[<>:"/\\|?*]/g, "-").trim();
	return `${sanitized}-${athleteId}`;
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase */
async function archiveExistingYearFileIfPresent(supabase, folderName, year) {
	const { data: listed, error: listErr } = await supabase.storage
		.from(BUCKET)
		.list(folderName, { limit: 1000 });

	if (listErr || !listed?.length) {
		return;
	}

	const candidates = sortYearImageFiles(
		listed.filter((f) => f.name && isPrimaryYearImageFile(f.name, year)),
	);

	if (candidates.length === 0) {
		return;
	}

	// Prefer archiving the best canonical file; all `year.*` blobs are removed so only the new `year.jpg` remains.
	const primaryPath = `${folderName}/${candidates[0].name}`;
	const { data, error: dlErr } = await supabase.storage.from(BUCKET).download(primaryPath);
	if (dlErr || !data) {
		const e = new Error(dlErr?.message || "Could not read existing year photo for archive");
		e.code = "STORAGE_DOWNLOAD_FAILED";
		throw e;
	}

	let buf = Buffer.from(await data.arrayBuffer());
	try {
		buf = await sharp(buf).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
	} catch (e) {
		const err = new Error(e.message || "Failed to convert existing photo to JPEG for archive");
		err.code = "ARCHIVE_CONVERT_FAILED";
		throw err;
	}

	const oldPath = `${folderName}/old${year}.jpg`;
	const { error: upErr } = await supabase.storage.from(BUCKET).upload(oldPath, buf, {
		contentType: "image/jpeg",
		upsert: true,
		cacheControl: "3600",
	});
	if (upErr) {
		const e = new Error(upErr.message || "Failed to archive existing photo");
		e.code = "STORAGE_ARCHIVE_FAILED";
		throw e;
	}

	const pathsToRemove = candidates.map((f) => `${folderName}/${f.name}`);
	const { error: rmErr } = await supabase.storage.from(BUCKET).remove(pathsToRemove);
	if (rmErr) {
		const e = new Error(rmErr.message || "Failed to remove prior year image files");
		e.code = "STORAGE_CLEANUP_FAILED";
		throw e;
	}
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} athleteId
 * @param {number} year
 * @param {Buffer} rawImageBuffer — encoded JPEG/PNG/WebP bytes
 */
async function processAthletePhotoUpload(supabase, athleteId, year, rawImageBuffer) {
	const { data: row, error: nameErr } = await supabase
		.from("names")
		.select("name")
		.eq("id", athleteId)
		.single();

	if (nameErr || !row?.name) {
		const e = new Error("Player not found");
		e.code = "PLAYER_NOT_FOUND";
		e.status = 404;
		throw e;
	}

	let croppedBuffer;
	try {
		const out = await cropPersonFromImageBuffer(rawImageBuffer, {
			outputFormat: "jpeg",
		});
		croppedBuffer = out.buffer;
	} catch (err) {
		if (
			err.code === "CROP_NO_POSE" ||
			err.code === "CROP_INSUFFICIENT_KEYPOINTS" ||
			err.code === "CROP_BAD_IMAGE"
		) {
			throw err;
		}
		throw err;
	}

	const folderName = buildFolderName(row.name, athleteId);

	await archiveExistingYearFileIfPresent(supabase, folderName, year);

	const destPath = `${folderName}/${year}.jpg`;
	const { error: upErr } = await supabase.storage.from(BUCKET).upload(destPath, croppedBuffer, {
		contentType: "image/jpeg",
		upsert: true,
		cacheControl: "3600",
	});

	if (upErr) {
		const e = new Error(upErr.message || "Upload failed");
		e.code = "STORAGE_UPLOAD_FAILED";
		throw e;
	}

	return { folderName, path: destPath };
}

function isValidUuid(s) {
	return (
		typeof s === "string" &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
	);
}

function parseYear(input) {
	const n =
		typeof input === "string" ? parseInt(input.trim(), 10) : Number(input);
	if (!Number.isInteger(n) || n < 2000 || n > 2100) {
		return null;
	}
	return n;
}

module.exports = {
	processAthletePhotoUpload,
	buildFolderName,
	BUCKET,
	isValidUuid,
	parseYear,
};
