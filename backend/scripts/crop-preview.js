#!/usr/bin/env node
/**
 * CLI: node scripts/crop-preview.js <input.jpg|png> [output.jpg]
 * Writes a tight full-body crop using MoveNet + Sharp.
 */
const fs = require("fs");
const path = require("path");
const { cropPersonFromImageBuffer } = require("../lib/cropFromPose");

async function main() {
	const inputPath = process.argv[2];
	if (!inputPath) {
		console.error("Usage: node scripts/crop-preview.js <input> [output]");
		process.exit(1);
	}
	const abs = path.resolve(inputPath);
	if (!fs.existsSync(abs)) {
		let extra = "";
		if (/\s+\//.test(inputPath)) {
			extra =
				"\nTip: Put input and output in separate quoted args: \".../in.jpg\" \".../out.jpg\"";
		}
		console.error(
			`Input file not found: ${abs}\n` +
				`Use a real path to your image (the docs example /path/to/wide-shot.jpg is only a placeholder).` +
				extra,
		);
		process.exit(1);
	}

	let outPath = process.argv[3];
	if (outPath) {
		const outResolved = path.resolve(outPath);
		if (fs.existsSync(outResolved) && fs.statSync(outResolved).isDirectory()) {
			outPath = path.join(
				outResolved,
				path.basename(abs, path.extname(abs)) + "-cropped.jpg",
			);
		} else {
			outPath = outResolved;
		}
	} else {
		outPath = path.join(
			path.dirname(abs),
			path.basename(abs, path.extname(abs)) + "-cropped.jpg",
		);
	}

	const buf = fs.readFileSync(abs);
	console.error("Running pose + crop (first run downloads the model)...");
	const { buffer, bbox, mime, debug } = await cropPersonFromImageBuffer(buf, {
		outputFormat: outPath.toLowerCase().endsWith(".png") ? "png" : "jpeg",
	});
	fs.writeFileSync(outPath, buffer);
	console.error("Wrote:", outPath);
	console.error("Bbox:", bbox);
	if (debug) {
		console.error("Debug:", debug);
		if (debug.bodyHeight != null && debug.hOut != null) {
			console.error(
				`Effective margins: side outsets ${debug.hOut}px (+${debug.sidePadPx ?? 0}px from frame width), top inset ${debug.topInset}px, head room ${debug.headRoomPx ?? 0}px, bottom extra ${debug.bottomExtra}px (+${debug.bottomImgPx ?? 0}px from frame height), body ~${Math.round(debug.bodyHeight)}px`,
			);
		}
	}
	console.error("Bytes:", buffer.length, mime);
}

main().catch((err) => {
	console.error(err.message || err);
	process.exit(1);
});
