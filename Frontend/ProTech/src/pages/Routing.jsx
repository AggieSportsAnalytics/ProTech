import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Homepage from "./Homepage";
import Recruitment from "./Recruitment";

function App() {
	return (
		<Router>
			<Routes>
				<Route path="/" element={<Homepage />} />
				<Route path="/recruitment" element={<Recruitment />} />
			</Routes>
		</Router>
	);
}

export default App;
