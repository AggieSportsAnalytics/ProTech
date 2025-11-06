import { useState, useEffect } from "react";
import "../Index.css";
import Loader from "../components/Loader";
import supabase from "../utils/supabase";
import RecruitmentModal from "../components/RecruitmentModal";
import AthleteCard from "../components/AthleteCard";
import AddDataModal from "../components/AddDataModal";
import NordBoard from "../components/NordBoard";
import ForcePlate from "../components/ForcePlate";
import AthleteComparisonChart from "../components/AthleteComparisonChart";

function Recruitment() {
	const [selectedPosition, setSelectedPosition] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [athletes, setAthletes] = useState([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [selectedType, setSelectedType] = useState(null);
	const [formData, setFormData] = useState({});

	useEffect(() => {
		const getAllPlayers = async () => {
			setLoading(true);
			const { data, error } = await supabase.from("Athlete_Data").select("*");

			if (error) {
				console.error("Supabase error:", error);
				setError(error.message);
			} else if (data) {
				setAthletes(data);
			} else {
				console.error("Error fetching names:", error);
				setAthletes([]);
			}

			setLoading(false);
		};

		getAllPlayers();
	}, []);

	if (error) {
		return <div className="p-8 text-red-600">Error: {error}</div>;
	}

	if (loading) {
		return <Loader />;
	}

	if (athletes.length === 0 && !loading) {
		return <div className="p-8">No players found.</div>;
	}
	// Filter athletes by position and search query
	const filteredAthletes = athletes.filter((athlete) => {
		const matchesPosition = !selectedPosition || athlete.position === selectedPosition;
		const matchesSearch = !searchQuery || 
			athlete.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			athlete.position.toLowerCase().includes(searchQuery.toLowerCase());
		return matchesPosition && matchesSearch;
		});
	

	return (
		<div className="min-h-screen bg-white">
			{/* Header */}
			<header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
					<div className="flex justify-between items-center">
						<div className="flex items-center">
							<h1 
								onClick={() => window.location.href = '/'}
								className="text-2xl font-bold text-[#0B1340] cursor-pointer hover:text-[#B4975A] transition-colors"
							>
								ProTech
							</h1>
						</div>
						<div className="flex items-center space-x-4">
							<div className="flex items-center space-x-4">
								<input
									type="text"
									placeholder="Search athletes..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B4975A] focus:border-transparent"
								/>
								<select
									className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B4975A] focus:border-transparent"
									value={selectedPosition}
									onChange={(e) => setSelectedPosition(e.target.value)}
								>
									<option value="">All Positions</option>
									{[...new Set(athletes.map(athlete => athlete.position))].map(position => (
										<option key={position} value={position}>{position}</option>
									))}
								</select>
								<button
									onClick={() => setIsModalOpen(true)}
									type="button"
									className="bg-[#B4975A] hover:bg-[#8B7443] text-white rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#B4975A] flex items-center"
								>
									<span className="text-sm">+</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-7xl mx-auto pt-24 pb-16 px-8">
				{filteredAthletes.length > 0 ? (
					<div className="relative">
						{/* Navigation Controls */}
						<div className="fixed top-1/2 -translate-y-1/2 left-4 z-10">
							<button
								onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : filteredAthletes.length - 1))}
								className="p-1 text-black hover:text-gray-600 transition-colors"
								aria-label="Previous athlete"
							>
								<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
								</svg>
							</button>
						</div>
						<div className="fixed top-1/2 -translate-y-1/2 right-4 z-10">
							<button
								onClick={() => setCurrentIndex((prev) => (prev < filteredAthletes.length - 1 ? prev + 1 : 0))}
								className="p-1 text-black hover:text-gray-600 transition-colors"
								aria-label="Next athlete"
							>
								<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
								</svg>
							</button>
						</div>

						{/* Athlete Display */}
						<div>
							<AthleteCard 
								athlete={filteredAthletes[currentIndex]} 
								setIsModalOpen={setIsModalOpen}
								setSelectedType={setSelectedType}
								setFormData={setFormData}
							/>
						</div>

						{/* Data Visualizations */}
						{filteredAthletes[currentIndex]?.id && (
							<div className="mt-12 space-y-8">
								{/* Performance Overview */}
								<div className="mb-8">
									<h2 className="text-xl font-semibold text-[#0B1340] mb-4">Performance Overview</h2>
									<div className="bg-white rounded-lg shadow-sm p-6">
										<AthleteComparisonChart id={filteredAthletes[currentIndex].id} />
									</div>
								</div>

								{/* NordBoard Data */}
								<div className="bg-white rounded-lg shadow-sm p-6">
									<h2 className="text-xl font-semibold text-[#0B1340] mb-4">NordBoard Data</h2>
									<NordBoard id={filteredAthletes[currentIndex].id} />
								</div>

								{/* Force Plate Data */}
								<div className="bg-white rounded-lg shadow-sm p-6">
									<h2 className="text-xl font-semibold text-[#0B1340] mb-4">Force Plate Data</h2>
									<ForcePlate id={filteredAthletes[currentIndex].id} />
								</div>
							</div>
						)}

						{/* Page Indicator */}
						<div className="text-center mt-2 text-sm text-gray-400">
							{currentIndex + 1} / {filteredAthletes.length}
						</div>
					</div>
				) : (
					<div className="text-center text-gray-500">No athletes found matching your criteria.</div>
				)}
			</main>

			<RecruitmentModal
				isModalOpen={isModalOpen}
				setIsModalOpen={setIsModalOpen}
				selectedType={selectedType}
				setSelectedType={setSelectedType}
				formData={formData}
				setFormData={setFormData}
			/>

			<div className="fixed bottom-0 left-0 right-0 bg-white shadow-sm z-50">
				
				<div>
					<AddDataModal
						isModalOpen={isModalOpen}
						setIsModalOpen={setIsModalOpen}
						selectedType={selectedType}
						setSelectedType={setSelectedType}
						formData={formData}
						setFormData={setFormData}
					/>
				</div>
			</div>
		</div>
	);
}

export default Recruitment;
