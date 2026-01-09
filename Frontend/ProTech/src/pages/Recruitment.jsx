import { useState, useEffect } from "react";
import "../index.css";
import Loader from "../components/Loader";
import supabase from "../utils/supabase";
import RecruitmentModal from "../components/RecruitmentModal";
import UploadCSV from "../components/UploadCSV";
import AthleteCard from "../components/AthleteCard";
import AddDataModal from "../components/AddDataModal";
import NordBoard from "../components/NordBoard";
import ForcePlate from "../components/ForcePlate";
import AthleteComparisonChart from "../components/AthleteComparisonChart";
import { formatNameFirstLast, sortByLastName } from "../utils/nameFormat";

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
	const [showSearchDropdown, setShowSearchDropdown] = useState(false);
	const [hasNordData, setHasNordData] = useState(false);
	const [hasForcePlateData, setHasForcePlateData] = useState(false);
	const [showUploadModal, setShowUploadModal] = useState(false);

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

	// sortByLastName is now imported from utils/nameFormat

	// Filter athletes by position only (search query only affects dropdown, not main view)
	let filteredAthletes = athletes.filter((athlete) => {
		const matchesPosition = !selectedPosition || athlete.position === selectedPosition;
		return matchesPosition;
	});

	// Sort by last name alphabetically
	filteredAthletes = sortByLastName(filteredAthletes);

	// Get current athlete ID
	const currentAthleteId = filteredAthletes[currentIndex]?.id;

	// Reset data flags when athlete changes (MUST be before early returns)
	useEffect(() => {
		setHasNordData(false);
		setHasForcePlateData(false);
	}, [currentAthleteId]);

	if (error) {
		return <div className="p-8 text-red-600">Error: {error}</div>;
	}

	if (loading) {
		return <Loader />;
	}

	if (athletes.length === 0 && !loading) {
		return <div className="p-8">No players found.</div>;
	}
	

	return (
		<div className="min-h-screen bg-[#022851]">
			{/* Header */}
			<header className="fixed top-0 left-0 right-0 bg-[#022851] shadow-lg border-b border-[#FFBF00]/20 z-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
					<div className="flex justify-between items-center">
						<div className="flex items-center gap-3">
							<img 
								src="/logo.png" 
								alt="Logo" 
								className="h-10 w-10 object-contain"
							/>
							<h1 
								onClick={() => window.location.href = '/'}
								className="text-2xl font-bold text-white cursor-pointer hover:text-[#FFBF00] transition-colors"
							>
								ProTech
							</h1>
						</div>
						<div className="flex items-center space-x-4">
							<button
								onClick={() => setShowUploadModal(true)}
								type="button"
								className="bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold px-4 py-2 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFBF00]"
							>
								Upload Data
							</button>
							<div className="flex items-center space-x-4 mt-2 space-y-4">
								{/* Search Dropdown */}
								<div className="relative">
									<input
										type="text"
										placeholder="Search athletes..."
										value={searchQuery}
										onChange={(e) => {
											setSearchQuery(e.target.value);
											setShowSearchDropdown(e.target.value.length > 0);
										}}
										onFocus={() => {
											if (searchQuery.length > 0) {
												setShowSearchDropdown(true);
											}
										}}
										onBlur={() => {
											// Delay to allow click on dropdown item
											setTimeout(() => setShowSearchDropdown(false), 200);
										}}
										className="px-4 py-2 bg-white border border-gray-300 text-[#022851] placeholder:text-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFBF00] focus:border-[#FFBF00] w-64"
									/>
									{showSearchDropdown && searchQuery.trim() && (() => {
										// Show all athletes matching search, regardless of position filter
										const searchMatches = sortByLastName(
											athletes.filter((athlete) => 
												athlete.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
												athlete.position?.toLowerCase().includes(searchQuery.toLowerCase())
											)
										);
										
										return (
											<div className="absolute z-50 w-64 mt-1 bg-[#022851] border border-[#FFBF00]/30 rounded-lg shadow-lg max-h-60 overflow-y-auto">
												{searchMatches.length > 0 ? (
													searchMatches.map((athlete, idx) => (
														<button
															key={athlete.id || idx}
															type="button"
															onMouseDown={(e) => {
																// Use onMouseDown to prevent onBlur from firing first
																e.preventDefault();
															}}
															onClick={() => {
																// First, check if we need to clear position filter
																const needsPositionClear = selectedPosition && athlete.position !== selectedPosition;
																
																if (needsPositionClear) {
																	setSelectedPosition("");
																}
																
																// Wait a tick for state to update, then find and navigate to athlete
																setTimeout(() => {
																	// Recalculate filtered list (now without position filter if we cleared it)
																	const currentFiltered = sortByLastName(
																		athletes.filter((a) => {
																			if (needsPositionClear) {
																				return true; // Show all if we cleared position filter
																			}
																			return !selectedPosition || a.position === selectedPosition;
																		})
																	);
																	
																	const index = currentFiltered.findIndex(a => a.id === athlete.id);
																	if (index !== -1) {
																		setCurrentIndex(index);
																	}
																}, 0);
																
																setSearchQuery("");
																setShowSearchDropdown(false);
															}}
															className="w-full text-left px-4 py-2 hover:bg-[#FFBF00]/20 focus:bg-[#FFBF00]/20 focus:outline-none transition-colors border-b border-[#FFBF00]/10 last:border-b-0"
														>
															<div className="font-medium text-white">{formatNameFirstLast(athlete.name)}</div>
															<div className="text-sm text-[#FFBF00]">{athlete.position}</div>
														</button>
													))
												) : (
													<div className="px-4 py-2 text-gray-400 text-sm">No athletes found</div>
												)}
											</div>
										);
									})()}
								</div>
								<select
									className="px-4 py-2 bg-white/10 border border-[#FFBF00]/30 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFBF00] focus:border-[#FFBF00] [&>option]:bg-[#022851] [&>option]:text-white"
									value={selectedPosition}
									onChange={(e) => setSelectedPosition(e.target.value)}
								>
									<option value="" className="bg-[#022851] text-white">All Positions</option>
									{[...new Set(athletes.map(athlete => athlete.position))].map(position => (
										<option key={position} value={position}>{position}</option>
									))}
								</select>
								<button
									onClick={() => setIsModalOpen(true)}
									type="button"
									className="bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFBF00] flex items-center"
									style={{ transform: "translateY(-10px)" }}   // ← move up 4px

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
				{showUploadModal && (
					<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
						<div className="bg-[#022851] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
							<div className="flex justify-between items-center p-6 border-b border-[#FFBF00]/20">
								<h2 className="text-2xl font-bold text-[#FFBF00]">Upload Combine File</h2>
								<button
									onClick={() => setShowUploadModal(false)}
									className="text-white hover:text-[#FFBF00] transition-colors text-2xl font-bold"
								>
									×
								</button>
							</div>
							<div className="p-6">
								<UploadCSV />
							</div>
						</div>
					</div>
				)}
				{filteredAthletes.length > 0 ? (
					<div className="relative">
						{/* Navigation Controls */}
						<div className="fixed top-1/2 -translate-y-1/2 left-4 z-10">
							<button
								onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : filteredAthletes.length - 1))}
								className="p-2 bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] transition-colors rounded-full shadow-lg"
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
								className="p-2 bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] transition-colors rounded-full shadow-lg"
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
									<h2 className="text-xl font-semibold text-white mb-4">Performance Overview</h2>
									<div className="bg-white rounded-lg shadow-lg p-6">
										<AthleteComparisonChart id={filteredAthletes[currentIndex].id} />
									</div>
								</div>

								{/* Hidden check for data */}
								<div style={{ display: 'none' }}>
									<NordBoard id={filteredAthletes[currentIndex].id} onHasData={setHasNordData} />
									<ForcePlate id={filteredAthletes[currentIndex].id} onHasData={setHasForcePlateData} />
								</div>

						{/* NordBoard Data */}
						{hasNordData && (
							<div className="bg-white rounded-lg shadow-lg p-6">
										
										<NordBoard id={filteredAthletes[currentIndex].id} />
									</div>
								)}

						{/* Force Plate Data */}
						{hasForcePlateData && (
							<div className="bg-white rounded-lg shadow-lg p-6">
										
										<ForcePlate id={filteredAthletes[currentIndex].id} />
									</div>
								)}
							</div>
						)}

				{/* Page Indicator */}
				<div className="text-center mt-2 text-sm text-[#FFBF00]">
					{currentIndex + 1} / {filteredAthletes.length}
				</div>
					</div>
				) : (
					<div className="text-center text-gray-400">No athletes found matching your criteria.</div>
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

			<div className="fixed bottom-0 left-0 right-0 bg-[#022851] border-t border-[#FFBF00]/20 shadow-lg z-50">
				
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
