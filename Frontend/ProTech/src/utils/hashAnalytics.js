export async function hashAnalytics(analytics) {
	const json = JSON.stringify(analytics);
	const data = new TextEncoder().encode(json);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(hashBuffer)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
