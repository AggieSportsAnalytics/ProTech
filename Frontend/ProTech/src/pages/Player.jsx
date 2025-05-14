import { useParams } from "react-router-dom";
import NordBoard from "../components/NordBoard";
import ForcePlate from "../components/ForcePlate";
import AthleteComparisonChart from "../components/AthleteComparisonChart";

function Data() {
	const { id } = useParams();

	return (
		<div className="p-8">
			<NordBoard id={id} />
			<ForcePlate id={id} />
			<AthleteComparisonChart id={id} />
		</div>
	);
}

export default Data;
