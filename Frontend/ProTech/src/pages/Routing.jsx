import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Homepage from "./Homepage";
import Recruitment from "./Recruitment";
import Alumni from "./Alumni";
import ProtectedRoute from "../components/ProtectedRoute";

function App() {
	return (
		<Router>
			<Routes>
				<Route path="/" element={<Homepage />} />
				<Route
					path="/recruitment"
					element={
						<ProtectedRoute>
							<Recruitment />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/alumni"
					element={
						<ProtectedRoute>
							<Alumni />
						</ProtectedRoute>
					}
				/>
				<Route path="*" element={<Homepage />} />
			</Routes>
		</Router>
	);
}

export default App;
