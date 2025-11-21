import { createContext, useContext, useEffect, useState } from "react";
import supabase from "../utils/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setUser(session?.user ?? null);
			setLoading(false);
		});

		supabase.auth.getSession().then(({ data }) => {
			setUser(data.session?.user ?? null);
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


