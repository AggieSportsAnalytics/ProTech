import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function LoginPage() {
	const { user, signInWithEmail, signUpWithEmail, sendMagicLink } = useAuth();
	const [mode, setMode] = useState("signin"); // signin | signup | magic
	const [form, setForm] = useState({ email: "", password: "" });
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const navigate = useNavigate();

	useEffect(() => {
		if (user) {
			navigate("/recruitment", { replace: true });
		}
	}, [user, navigate]);

	// Debug: Check Supabase connection on mount
	useEffect(() => {
		console.log("=== HOMEPAGE MOUNTED ===");
		const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
		const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
		console.log("Homepage - URL:", supabaseUrl ? "✓ Set" : "✗ Missing");
		console.log("Homepage - Key:", supabaseKey ? "✓ Set" : "✗ Missing");
		
		// Clear any stale Supabase tokens from localStorage
		if (typeof window !== 'undefined') {
			const keys = Object.keys(localStorage);
			keys.forEach(key => {
				if (key.includes('supabase') || key.includes('sb-')) {
					console.log("Clearing cached token:", key);
					localStorage.removeItem(key);
				}
			});
			console.log("✓ Cleared cached Supabase tokens");
		}
	}, []);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSubmitting(true);
		setMessage("");
		try {
			if (mode === "magic") {
				await sendMagicLink(form.email);
				setMessage("Check your email for a sign-in link.");
				return;
			}

			if (mode === "signup") {
				const { error } = await signUpWithEmail(form.email, form.password);
				if (error) throw error;
				setMessage("Account created. Please confirm via email, then sign in.");
			} else {
				const { error } = await signInWithEmail(form.email, form.password);
				if (error) throw error;
			}
		} catch (err) {
			console.error("Login error:", err);
			let errorMessage = err.message || "Something went wrong.";
			
			// Provide more helpful error messages
			if (err.message?.includes("Failed to fetch") || err.message?.includes("fetch")) {
				errorMessage = "Network error: Unable to connect to Supabase. Please check your internet connection and ensure your Supabase environment variables are configured correctly.";
			} else if (err.message?.includes("Invalid login credentials")) {
				errorMessage = "Invalid email or password. Please try again.";
			} else if (err.message?.includes("Email not confirmed")) {
				errorMessage = "Please check your email and confirm your account before signing in.";
			}
			
			setMessage(errorMessage);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen bg-white">
			<div className="relative flex min-h-screen items-center">
				<div className="absolute left-0 top-0 h-full w-3/5">
					<img src="/blue.png" alt="Football Player" className="h-full w-full object-cover" />
					<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-white"></div>
				</div>

				<div className="ml-auto w-full lg:w-1/2 pr-12 flex justify-end">
					<div className="w-full max-w-md space-y-6">
						<div className="text-right">
							<h1 className="text-[6rem] md:text-[8rem] font-black leading-none tracking-tighter text-[#0B1340]">
								PRO
								<br />
								<span className="text-[#B4975A]">TECH</span>
							</h1>
							<p className="text-lg md:text-xl text-gray-600 mt-4 font-medium">
								for UC Davis Football by Aggie Sports Analytics
							</p>
						</div>

						<form onSubmit={handleSubmit} className="bg-white/90 border border-gray-100 shadow-xl rounded-2xl p-8 space-y-4">
							<h2 className="text-2xl font-semibold text-[#022851] text-right">
								{mode === "signup"
									? "Create an account"
									: mode === "magic"
									? "Magic link sign-in"
									: "Sign in to continue"}
							</h2>

							<input
								type="email"
								placeholder="Email"
								className="w-full border border-gray-300 rounded-lg px-4 py-2"
								value={form.email}
								onChange={(e) => setForm({ ...form, email: e.target.value })}
								required
							/>

							{mode !== "magic" && (
								<input
									type="password"
									placeholder="Password"
									className="w-full border border-gray-300 rounded-lg px-4 py-2"
									value={form.password}
									onChange={(e) => setForm({ ...form, password: e.target.value })}
									required
								/>
							)}

							<button
								type="submit"
								disabled={submitting}
								className="w-full bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-60"
							>
								{submitting
									? "Please wait..."
									: mode === "signup"
									? "Create account"
									: mode === "magic"
									? "Send magic link"
									: "Sign in"}
							</button>

							{message && (
								<p className="text-sm text-center text-[#022851] bg-[#FFBF00]/20 rounded-md px-3 py-2">
									{message}
								</p>
							)}

							<div className="flex justify-center gap-4 text-sm text-gray-600">
								<button type="button" onClick={() => setMode("signin")}>
									Sign in
								</button>
								<button type="button" onClick={() => setMode("signup")}>
									Create account
								</button>
								<button type="button" onClick={() => setMode("magic")}>
									Magic link
								</button>
							</div>
						</form>
					</div>
				</div>

				<div className="absolute bottom-4 right-8 pr-4 text-xs text-gray-400">
					Built by{" "}
					<a href="https://aggiesportsanalytics.com" target="_blank" rel="noreferrer" className="underline">
						Aggie Sports Analytics
					</a>
				</div>
			</div>
		</div>
	);
}

export default LoginPage;
