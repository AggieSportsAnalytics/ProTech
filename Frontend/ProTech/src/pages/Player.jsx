import { useParams } from "react-router-dom";
import NordBoard from "../components/NordBoard";
import ForcePlate from "../components/ForcePlate";

function Data() {
	const { name } = useParams();

	return (
		<div className="p-8">
			<NordBoard name={name.replaceAll("-", " ")} />
			<ForcePlate name={name.replaceAll("-", " ")} />
		</div>
	);
}

export default Data;
