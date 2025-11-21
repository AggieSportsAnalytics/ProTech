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
			setMessage(err.message || "Something went wrong.");
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
