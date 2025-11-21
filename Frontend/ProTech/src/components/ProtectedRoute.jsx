import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function ProtectedRoute({ children }) {
	const { user, loading } = useAuth();

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center text-gray-500">
				Loading...
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/" replace />;
	}

	return children;
}

export default ProtectedRoute;


