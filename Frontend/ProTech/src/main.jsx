// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./pages/Routing";

// createRoot(document.getElementById("root")).render(
// 	<StrictMode>
// 		<App />
// 	</StrictMode>,
// );

createRoot(document.getElementById("root")).render(<App />);
