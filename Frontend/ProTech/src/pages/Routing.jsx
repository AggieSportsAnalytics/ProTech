import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Homepage from "./Homepage";
import Recruitment from "./Recruitment";
import Data from "./Data";
import Player from "./Player";

function App() {
	return (
		<Router>
			<Routes>
				<Route path="/" element={<Homepage />} />
				<Route path="/recruitment" element={<Recruitment />} />
				<Route path="/data" element={<Data />} />
				<Route path="/data/:name" element={<Player />} />
			</Routes>
		</Router>
	);
}

export default App;
