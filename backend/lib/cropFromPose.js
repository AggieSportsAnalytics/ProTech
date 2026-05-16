/**
 * Full-body crop: MoveNet keypoints → axis-aligned bbox → Sharp extract.
 * Requires: @tensorflow/tfjs-node (loaded first), @tensorflow-models/pose-detection, sharp, canvas.
 */

require("@tensorflow/tfjs-node");

const poseDetection = require("@tensorflow-models/pose-detection");
const sharp = require("sharp");
const { createCanvas, loadImage } = require("canvas");

const { SupportedModels, movenet } = poseDetection;

/** Keypoints for horizontal min/max (exclude wrists — often wider than torso; exclude ankle x — feet together). */
const WIDTH_KEYPOINT_NAMES = [
	"left_shoulder",
	"right_shoulder",
	"left_elbow",
	"right_elbow",
	"left_hip",
	"right_hip",
	"left_knee",
	"right_knee",
];

let detectorPromise = null;

function getMoveNetDetector() {
	if (!detectorPromise) {
		detectorPromise = poseDetection.createDetector(SupportedModels.MoveNet, {
			modelType: movenet.modelType.SINGLEPOSE_THUNDER,
			enableSmoothing: false,
		});
	}
	return detectorPromise;
}

/** @param {import('@tensorflow-models/pose-detection').Keypoint[]} keypoints */
function keypointsByName(keypoints) {
	const map = new Map();
	for (const kp of keypoints) {
		if (kp.name) {
			map.set(kp.name, kp);
		}
	}
	return map;
}

function scoreOk(kp, minScore) {
	return kp && typeof kp.score === "number" && kp.score >= minScore;
}

/**
 * Vertical anchor for head/body (prefer nose, else eye midpoint).
 * @returns {{ y: number, score: number } | null}
 */
function headAnchorY(byName, minScore) {
	const nose = byName.get("nose");
	if (scoreOk(nose, minScore)) {
		return { y: nose.y, score: nose.score };
	}
	const le = byName.get("left_eye");
	const re = byName.get("right_eye");
	if (scoreOk(le, minScore) && scoreOk(re, minScore)) {
		return { y: (le.y + re.y) / 2, score: Math.min(le.score, re.score) };
	}
	if (scoreOk(le, minScore)) {
		return { y: le.y, score: le.score };
	}
	if (scoreOk(re, minScore)) {
		return { y: re.y, score: re.score };
	}
	return null;
}

/** Estimate face height from eyes / ears for head-top heuristic fallback. */
function estimateFaceHeight(byName, minScore) {
	const le = byName.get("left_eye");
	const re = byName.get("right_eye");
	if (scoreOk(le, minScore) && scoreOk(re, minScore)) {
		return Math.abs(le.y - re.y) + Math.hypot(re.x - le.x, re.y - le.y) * 1.4;
	}
	const nose = byName.get("nose");
	const ear =
		byName.get("left_ear") && scoreOk(byName.get("left_ear"), minScore)
			? byName.get("left_ear")
			: byName.get("right_ear");
	if (scoreOk(nose, minScore) && scoreOk(ear, minScore)) {
		return Math.hypot(ear.x - nose.x, ear.y - nose.y) * 1.6;
	}
	return null;
}

/**
 * @typedef {object} BBoxPx
 * @property {number} left
 * @property {number} top
 * @property {number} width
 * @property {number} height
 */

/**
 * @param {object} params
 * @param {import('@tensorflow-models/pose-detection').Keypoint[]} params.keypoints — scaled to **original** image pixels
 * @param {number} params.minKeypointScore
 * @param {number} params.paddingPx
 * @param {number} params.extraBottomPad — base extra space below ankles (before bottomPadExtraPx)
 * @param {number} [params.horizontalPadOutsetPx=0] — extra padding on **each** side (pixels)
 * @param {number} [params.horizontalPadOutsetBodyFrac=0] — extra each side as fraction of body height (scales on large photos)
 * @param {number} [params.bottomPadExtraPx=0] — added below extraBottomPad (pixels)
 * @param {number} [params.bottomPadExtraBodyFrac=0] — more bottom margin as fraction of body height
 * @param {number} [params.topCropInsetPx=0] — move crop top edge **down** (pixels)
 * @param {number} [params.topCropInsetBodyFrac=0] — same, as fraction of body height (main fix for “too much sky” on big images)
 * @param {number} params.headBodyFraction — head extends above anchor by this × body height (nose→feet)
 * @param {number} params.headFaceFraction — if body height unreliable, extend by this × face height
 * @param {number} [params.sidePadEachImageWidthFrac] — each side extends by frac×imageWidth
 * @param {number} [params.bottomPadImageHeightFrac] — extend crop down by frac×imageHeight
 * @param {number} [params.headRoomImageHeightFrac] — extend crop up by frac×imageHeight (more sky above head)
 * @param {number} params.imageWidth
 * @param {number} params.imageHeight
 * @param {string[]} [params.widthKeypointNames]
 * @returns {{ bbox: BBoxPx, debug?: object }}
 */
function computeCropBoxPixels({
	keypoints,
	minKeypointScore,
	paddingPx,
	extraBottomPad,
	horizontalPadOutsetPx = 0,
	horizontalPadOutsetBodyFrac = 0,
	bottomPadExtraPx = 0,
	bottomPadExtraBodyFrac = 0,
	topCropInsetPx = 0,
	topCropInsetBodyFrac = 0,
	sidePadEachImageWidthFrac = 0,
	bottomPadImageHeightFrac = 0,
	headRoomImageHeightFrac = 0,
	imageWidth,
	imageHeight,
	headBodyFraction,
	headFaceFraction,
	widthKeypointNames = WIDTH_KEYPOINT_NAMES,
}) {
	const byName = keypointsByName(keypoints);

	const leftAnkle = byName.get("left_ankle");
	const rightAnkle = byName.get("right_ankle");
	let bottomY = null;
	if (scoreOk(leftAnkle, minKeypointScore)) {
		bottomY = leftAnkle.y;
	}
	if (scoreOk(rightAnkle, minKeypointScore)) {
		bottomY = bottomY == null ? rightAnkle.y : Math.max(bottomY, rightAnkle.y);
	}

	if (bottomY == null) {
		const err = new Error(
			"Could not locate both ankles with sufficient confidence; refuse to crop",
		);
		err.code = "CROP_INSUFFICIENT_KEYPOINTS";
		throw err;
	}

	const anchor = headAnchorY(byName, minKeypointScore);
	if (!anchor) {
		const err = new Error(
			"Could not locate nose or eyes for head anchor; refuse to crop",
		);
		err.code = "CROP_INSUFFICIENT_KEYPOINTS";
		throw err;
	}

	const faceH = estimateFaceHeight(byName, minKeypointScore);
	const bodyHeight = bottomY - anchor.y;
	let headTopY;
	if (bodyHeight > 10) {
		headTopY = anchor.y - headBodyFraction * bodyHeight;
	} else if (faceH != null && faceH > 2) {
		headTopY = anchor.y - headFaceFraction * faceH;
	} else {
		headTopY = anchor.y - headBodyFraction * (bottomY - anchor.y || 100);
	}

	const hOut =
		horizontalPadOutsetPx +
		Math.round(horizontalPadOutsetBodyFrac * bodyHeight);
	const bottomExtra =
		bottomPadExtraPx +
		Math.round(bottomPadExtraBodyFrac * bodyHeight);
	const topInset =
		topCropInsetPx + Math.round(topCropInsetBodyFrac * bodyHeight);

	/** @type {number[]} */
	const xs = [];
	/** @type {number[]} */
	const ys = [headTopY, bottomY];

	for (const name of widthKeypointNames) {
		const kp = byName.get(name);
		if (scoreOk(kp, minKeypointScore)) {
			xs.push(kp.x);
			ys.push(kp.y);
		}
	}

	if (xs.length < 2) {
		const err = new Error(
			"Not enough shoulder/arm/ankle keypoints for horizontal bounds; refuse to crop",
		);
		err.code = "CROP_INSUFFICIENT_KEYPOINTS";
		throw err;
	}

	const pad = paddingPx;
	const sidePad =
		imageWidth != null ? sidePadEachImageWidthFrac * imageWidth : 0;
	const bottomImg =
		imageHeight != null ? bottomPadImageHeightFrac * imageHeight : 0;
	const headRoom =
		imageHeight != null ? headRoomImageHeightFrac * imageHeight : 0;

	let leftF = Math.min(...xs) - pad - hOut - sidePad;
	let rightF = Math.max(...xs) + pad + hOut + sidePad;
	let topF = Math.min(...ys) - pad + topInset - headRoom;
	let bottomF =
		Math.max(...ys) + pad + extraBottomPad + bottomExtra + bottomImg;

	const li = Math.floor(leftF);
	const ti = Math.floor(topF);
	const ri = Math.ceil(rightF);
	const bi = Math.ceil(bottomF);

	return {
		bbox: {
			left: li,
			top: ti,
			width: Math.max(1, ri - li),
			height: Math.max(1, bi - ti),
		},
		debug: {
			headTopY,
			bodyHeight,
			faceH,
			anchorY: anchor.y,
			bottomY,
			hOut,
			bottomExtra,
			topInset,
			horizontalPadOutsetPx,
			horizontalPadOutsetBodyFrac,
			bottomPadExtraPx,
			bottomPadExtraBodyFrac,
			topCropInsetPx,
			topCropInsetBodyFrac,
			sidePadEachImageWidthFrac,
			sidePadPx: Math.round(sidePad),
			bottomPadImageHeightFrac,
			bottomImgPx: Math.round(bottomImg),
			headRoomImageHeightFrac,
			headRoomPx: Math.round(headRoom),
		},
	};
}

function clampBoxToImage(bbox, imageWidth, imageHeight) {
	const left = Math.max(0, Math.min(bbox.left, imageWidth - 1));
	const top = Math.max(0, Math.min(bbox.top, imageHeight - 1));
	let right = left + bbox.width;
	let bottom = top + bbox.height;
	right = Math.min(right, imageWidth);
	bottom = Math.min(bottom, imageHeight);
	let width = right - left;
	let height = bottom - top;
	width = Math.max(1, Math.round(width));
	height = Math.max(1, Math.round(height));
	return { left: Math.floor(left), top: Math.floor(top), width, height };
}

/**
 * Scale keypoints from inference resolution to original image pixels.
 * @param {import('@tensorflow-models/pose-detection').Keypoint[]} keypoints
 */
function scaleKeypoints(keypoints, scaleX, scaleY) {
	return keypoints.map((kp) => ({
		...kp,
		x: kp.x * scaleX,
		y: kp.y * scaleY,
	}));
}

/**
 * @typedef {object} CropPersonOptions
 * @property {number} [paddingPx=14]
 * @property {number} [extraBottomPad=16] — base space below ankles
 * @property {number} [horizontalPadOutsetPx=10] — extra px on **left and right** (fixed)
 * @property {number} [horizontalPadOutsetBodyFrac=0.018] — extra each side as fraction of body height (scales on large photos)
 * @property {number} [bottomPadExtraPx=24] — more room below feet (fixed)
 * @property {number} [bottomPadExtraBodyFrac=0.045] — more bottom as fraction of body height
 * @property {number} [topCropInsetPx=12] — move crop top **down** (fixed)
 * @property {number} [topCropInsetBodyFrac=0.028] — same as fraction of body height (reduces headroom on high-res)
 * @property {number} [sidePadEachImageWidthFrac=0.02] — each side + this × frame width
 * @property {number} [bottomPadImageHeightFrac=0.03] — extra bottom = this × frame height
 * @property {number} [headRoomImageHeightFrac=0.005] — extra above head = this × frame height
 * @property {number} [minKeypointScore=0.25]
 * @property {number} [maxInferenceSide=1024]
 * @property {number} [headBodyFraction=0.11] — lower = tighter crop above hair
 * @property {number} [headFaceFraction=0.55]
 * @property {string[]} [widthKeypointNames] — override which keypoints set horizontal bounds (defaults to shoulders/elbows/hips/knees; omit wrists for tighter crops)
 * @property {string} [outputFormat='jpeg'] 'jpeg' | 'png'
 * @property {number} [jpegQuality=92]
 * @property {boolean} [autoOrient=true] — apply EXIF Orientation before pose + crop (required for most phone photos)
 */

/**
 * Apply EXIF Orientation so pixel layout matches how the image displays (upright).
 * @param {Buffer} buf
 * @returns {Promise<Buffer>}
 */
async function normalizeOrientationToBuffer(buf) {
	return sharp(buf).rotate().toBuffer();
}

/**
 * @param {Buffer} inputBuffer — encoded image (JPEG/PNG/WebP)
 * @param {CropPersonOptions} [options]
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, bbox: BBoxPx, mime: string, debug?: object }>}
 */
async function cropPersonFromImageBuffer(inputBuffer, options = {}) {
	const paddingPx = options.paddingPx ?? 14;
	const extraBottomPad = options.extraBottomPad ?? 16;
	const horizontalPadOutsetPx = options.horizontalPadOutsetPx ?? 10;
	const horizontalPadOutsetBodyFrac =
		options.horizontalPadOutsetBodyFrac ?? 0.018;
	const bottomPadExtraPx = options.bottomPadExtraPx ?? 24;
	const bottomPadExtraBodyFrac = options.bottomPadExtraBodyFrac ?? 0.045;
	const topCropInsetPx = options.topCropInsetPx ?? 12;
	const topCropInsetBodyFrac = options.topCropInsetBodyFrac ?? 0.028;
	const sidePadEachImageWidthFrac = options.sidePadEachImageWidthFrac ?? 0.02;
	const bottomPadImageHeightFrac = options.bottomPadImageHeightFrac ?? 0.03;
	const headRoomImageHeightFrac = options.headRoomImageHeightFrac ?? 0.005;
	const minKeypointScore = options.minKeypointScore ?? 0.25;
	const maxInferenceSide = options.maxInferenceSide ?? 1024;
	const headBodyFraction = options.headBodyFraction ?? 0.11;
	const headFaceFraction = options.headFaceFraction ?? 0.55;
	const widthKeypointNames = options.widthKeypointNames ?? WIDTH_KEYPOINT_NAMES;
	const outputFormat = options.outputFormat ?? "jpeg";
	const jpegQuality = options.jpegQuality ?? 92;
	const autoOrient = options.autoOrient !== false;

	const workBuffer = autoOrient
		? await normalizeOrientationToBuffer(inputBuffer)
		: inputBuffer;

	const meta = await sharp(workBuffer).metadata();
	const ow = meta.width;
	const oh = meta.height;
	if (!ow || !oh) {
		const err = new Error("Could not read image dimensions");
		err.code = "CROP_BAD_IMAGE";
		throw err;
	}

	let inferW = ow;
	let inferH = oh;
	let inferBuf = workBuffer;
	const maxDim = Math.max(ow, oh);
	if (maxDim > maxInferenceSide) {
		const scale = maxInferenceSide / maxDim;
		inferW = Math.round(ow * scale);
		inferH = Math.round(oh * scale);
		inferBuf = await sharp(workBuffer).resize(inferW, inferH).toBuffer();
	}

	const scaleX = ow / inferW;
	const scaleY = oh / inferH;

	const img = await loadImage(inferBuf);
	const canvas = createCanvas(img.width, img.height);
	const ctx = canvas.getContext("2d");
	ctx.drawImage(img, 0, 0);

	const detector = await getMoveNetDetector();
	const poses = await detector.estimatePoses(canvas, {
		flipHorizontal: false,
		maxPoses: 1,
	});

	if (!poses.length || !poses[0].keypoints?.length) {
		const err = new Error("No person pose detected");
		err.code = "CROP_NO_POSE";
		throw err;
	}

	const scaledKp = scaleKeypoints(poses[0].keypoints, scaleX, scaleY);

	const { bbox: rawBox, debug } = computeCropBoxPixels({
		keypoints: scaledKp,
		minKeypointScore,
		paddingPx,
		extraBottomPad,
		horizontalPadOutsetPx,
		horizontalPadOutsetBodyFrac,
		bottomPadExtraPx,
		bottomPadExtraBodyFrac,
		topCropInsetPx,
		topCropInsetBodyFrac,
		sidePadEachImageWidthFrac,
		bottomPadImageHeightFrac,
		headRoomImageHeightFrac,
		imageWidth: ow,
		imageHeight: oh,
		headBodyFraction,
		headFaceFraction,
		widthKeypointNames,
	});

	const bbox = clampBoxToImage(rawBox, ow, oh);

	const cropped = await sharp(workBuffer)
		.extract({
			left: bbox.left,
			top: bbox.top,
			width: bbox.width,
			height: bbox.height,
		})
		.toFormat(outputFormat, outputFormat === "jpeg" ? { quality: jpegQuality } : {})
		.toBuffer();

	const mime = outputFormat === "png" ? "image/png" : "image/jpeg";

	return {
		buffer: cropped,
		width: bbox.width,
		height: bbox.height,
		bbox,
		mime,
		debug: { ...debug, autoOrient },
	};
}

function resetPoseDetectorForTests() {
	detectorPromise = null;
}

module.exports = {
	cropPersonFromImageBuffer,
	normalizeOrientationToBuffer,
	computeCropBoxPixels,
	scaleKeypoints,
	resetPoseDetectorForTests,
	getMoveNetDetector,
	WIDTH_KEYPOINT_NAMES,
};
