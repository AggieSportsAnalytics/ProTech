import { createContext, useContext, useEffect, useState } from "react";
import supabase from "../utils/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Clear any stale tokens from localStorage on mount
		if (typeof window !== 'undefined') {
			const keys = Object.keys(localStorage);
			keys.forEach(key => {
				if (key.includes('supabase') || key.includes('sb-')) {
					localStorage.removeItem(key);
				}
			});
			console.log("✓ Cleared cached Supabase tokens");
		}

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setUser(session?.user ?? null);
			setLoading(false);
		});

		// Get session with error handling to prevent token refresh errors
		supabase.auth.getSession()
			.then(({ data, error }) => {
				if (error) {
					console.warn("Session check error (this is OK if not logged in):", error.message);
				}
				setUser(data?.session?.user ?? null);
				setLoading(false);
			})
			.catch((err) => {
				console.warn("Failed to get session (this is OK if not logged in):", err);
				setLoading(false);
			});

		return () => subscription.unsubscribe();
	}, []);

	const signInWithEmail = (email, password) =>
		supabase.auth.signInWithPassword({ email, password });

	const signUpWithEmail = (email, password) =>
		supabase.auth.signUp({ email, password });

	const sendMagicLink = (email) =>
		supabase.auth.signInWithOtp({
			email,
			options: { emailRedirectTo: window.location.origin },
		});

	const signOut = () => supabase.auth.signOut();

	return (
		<AuthContext.Provider
			value={{
				user,
				loading,
				signInWithEmail,
				signUpWithEmail,
				sendMagicLink,
				signOut,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export const useAuth = () => useContext(AuthContext);


