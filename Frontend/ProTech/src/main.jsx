// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./pages/Routing";
import { AuthProvider } from "./contexts/AuthContext";

// createRoot(document.getElementById("root")).render(
// 	<StrictMode>
// 		<App />
// 	</StrictMode>,
// );

createRoot(document.getElementById("root")).render(
	<AuthProvider>
		<App />
	</AuthProvider>,
);
