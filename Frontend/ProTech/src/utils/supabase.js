import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug: Log environment variables (only in development)
console.log("=== SUPABASE CONFIG CHECK ===");
console.log("URL:", supabaseUrl ? "✓ Set" : "✗ Missing");
console.log("Key:", supabaseKey ? "✓ Set" : "✗ Missing");
console.log("Full URL:", supabaseUrl || "NOT SET");
console.log("Key exists:", !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
	console.error("❌ Missing Supabase environment variables!");
	console.error("Make sure your .env file exists and contains:");
	console.error("VITE_SUPABASE_URL=your_url");
	console.error("VITE_SUPABASE_ANON_KEY=your_key");
	console.error("File location: Frontend/ProTech/.env");
	console.error("After creating/editing .env, RESTART the dev server!");
}

// Create Supabase client with explicit error handling
let supabase;
	try {
		if (!supabaseUrl || !supabaseKey) {
			throw new Error("Missing Supabase credentials");
		}

		supabase = createClient(supabaseUrl, supabaseKey, {
			auth: {
				autoRefreshToken: true,
				persistSession: true,
				// Needed so magic-link / OAuth redirects can restore the session
				detectSessionInUrl: true,
			},
		});
	
	console.log("✓ Supabase client initialized");
} catch (error) {
	console.error("❌ Failed to create Supabase client:", error);
	// Create a dummy client to prevent app crash
	supabase = createClient("https://placeholder.supabase.co", "placeholder");
}

export default supabase;
