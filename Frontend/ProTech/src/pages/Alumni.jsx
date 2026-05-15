import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "../index.css";
import Loader from "../components/Loader";
import supabase from "../utils/supabase";
import AthleteCard from "../components/AthleteCard";
import NordBoard from "../components/NordBoard";
import ForcePlate from "../components/ForcePlate";
import AthleteComparisonChart from "../components/AthleteComparisonChart";
import PlayerOverview from "../components/PlayerOverview";
import { formatNameFirstLast, sortByLastName } from "../utils/nameFormat";

function Alumni() {
	const [selectedPosition, setSelectedPosition] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [athletes, setAthletes] = useState([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	// Start true so first paint matches fetch-in-progress (avoids empty-state → Loader flash)
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showSearchDropdown, setShowSearchDropdown] = useState(false);
	const [hasNordData, setHasNordData] = useState(false);
	const [hasForcePlateData, setHasForcePlateData] = useState(false);

	useEffect(() => {
		const getAlumni = async () => {
			setLoading(true);
			setError("");

			// 1. Pull id from names where is_alumni is true (alumni roster)
			const { data: nameRows, error: errNames } = await supabase
				.from("names")
				.select("id")
				.eq("is_alumni", true);

			if (errNames) {
				console.error("Supabase error (names):", errNames);
				setError(errNames.message);
				setAthletes([]);
				setLoading(false);
				return;
			}

			const ids = (nameRows || []).map((r) => r.id).filter(Boolean);
			if (ids.length === 0) {
				setAthletes([]);
				setLoading(false);
				return;
			}

			// 2. Use id to get all data from Athlete_Data (same as recruitment)
			const { data: athleteData, error: errData } = await supabase
				.from("Athlete_Data")
				.select("*")
				.in("id", ids);

			if (errData) {
				console.error("Supabase error (Athlete_Data):", errData);
				setError(errData.message);
				setAthletes([]);
			} else {
				setAthletes(athleteData || []);
			}

			setLoading(false);
		};

		getAlumni();
	}, []);

	let filteredAthletes = athletes.filter((athlete) => {
		const matchesPosition = !selectedPosition || athlete.position === selectedPosition;
		return matchesPosition;
	});
	filteredAthletes = sortByLastName(filteredAthletes);

	const currentAthleteId = filteredAthletes[currentIndex]?.id;

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
		return (
			<div className="min-h-screen bg-[#022851]">
				<header className="fixed top-0 left-0 right-0 bg-[#022851] shadow-lg border-b border-[#FFBF00]/20 z-50">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
						<div className="flex justify-between items-center">
							<div className="flex items-center gap-3">
								<img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain" />
								<h1
									onClick={() => (window.location.href = "/")}
									className="text-2xl font-bold text-white cursor-pointer hover:text-[#FFBF00] transition-colors"
								>
									ProTech
								</h1>
							</div>
							<Link
								to="/recruitment"
								className="px-4 py-2 bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold rounded-lg transition-colors"
							>
								Roster
							</Link>
						</div>
					</div>
				</header>
				<main className="max-w-7xl mx-auto pt-24 pb-16 px-8">
					<div className="p-8 text-gray-400">No alumni found.</div>
				</main>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#022851]">
			<header className="fixed top-0 left-0 right-0 bg-[#022851] shadow-lg border-b border-[#FFBF00]/20 z-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
					<div className="flex justify-between items-center">
						<div className="flex items-center gap-3">
							<img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain" />
							<h1
								onClick={() => (window.location.href = "/")}
								className="text-2xl font-bold text-white cursor-pointer hover:text-[#FFBF00] transition-colors"
							>
								ProTech
							</h1>
						</div>
						<div className="flex items-center gap-4 flex-nowrap">
							<div className="flex items-center gap-4 flex-nowrap flex-shrink-0">
								<div className="relative">
									<input
										type="text"
										placeholder="Search alumni..."
										value={searchQuery}
										onChange={(e) => {
											setSearchQuery(e.target.value);
											setShowSearchDropdown(e.target.value.length > 0);
										}}
										onFocus={() => searchQuery.length > 0 && setShowSearchDropdown(true)}
										onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
										className="h-[42px] box-border px-4 py-2 bg-white border border-gray-300 text-[#022851] placeholder:text-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFBF00] focus:border-[#FFBF00] w-64 flex-shrink-0"
									/>
									{showSearchDropdown && searchQuery.trim() &&
										(() => {
											const searchLower = searchQuery.toLowerCase().trim();
											const searchMatches = sortByLastName(
												athletes.filter((athlete) => {
													if (athlete.position?.toLowerCase().includes(searchLower)) return true;
													const storedName = athlete.name?.toLowerCase() || "";
													if (storedName.includes(searchLower)) return true;
													const formattedName = formatNameFirstLast(athlete.name || "").toLowerCase();
													if (formattedName.includes(searchLower)) return true;
													const nameParts = formattedName.split(/\s+/).filter((p) => p.length > 0);
													const searchParts = searchLower.split(/\s+/).filter((p) => p.length > 0);
													if (searchParts.length > 1 && searchParts.length <= nameParts.length) {
														if (searchParts.every((sp, i) => i < nameParts.length && nameParts[i].startsWith(sp)))
															return true;
													} else if (searchParts.length === 1 && nameParts.some((np) => np.startsWith(searchParts[0]))) {
														return true;
													}
													return false;
												})
											);
											return (
												<div className="absolute z-50 w-64 mt-1 bg-[#022851] border border-[#FFBF00]/30 rounded-lg shadow-lg max-h-60 overflow-y-auto">
													{searchMatches.length > 0 ? (
														searchMatches.map((athlete, idx) => (
															<button
																key={athlete.id || idx}
																type="button"
																onMouseDown={(e) => e.preventDefault()}
																onClick={() => {
																	const needsPositionClear = selectedPosition && athlete.position !== selectedPosition;
																	if (needsPositionClear) setSelectedPosition("");
																	setTimeout(() => {
																		const currentFiltered = sortByLastName(
																			athletes.filter((a) =>
																				needsPositionClear ? true : !selectedPosition || a.position === selectedPosition
																			)
																		);
																		const index = currentFiltered.findIndex((a) => a.id === athlete.id);
																		if (index !== -1) setCurrentIndex(index);
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
														<div className="px-4 py-2 text-gray-400 text-sm">No alumni found</div>
													)}
												</div>
											);
										})()}
								</div>
								<div className="h-[42px] flex items-stretch flex-shrink-0">
									<select
										className="h-full min-w-[140px] box-border pl-4 pr-9 bg-white/10 border border-[#FFBF00]/30 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFBF00] focus:border-[#FFBF00] [&>option]:bg-[#022851] [&>option]:text-white appearance-none cursor-pointer bg-no-repeat bg-[length:12px_12px] bg-[right_12px_center]"
										style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23FFBF00'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")" }}
										value={selectedPosition}
										onChange={(e) => setSelectedPosition(e.target.value)}
									>
										<option value="" className="bg-[#022851] text-white">All Positions</option>
										{[...new Set(athletes.map((a) => a.position))].map((position) => (
											<option key={position} value={position}>{position}</option>
										))}
									</select>
								</div>
								<Link
									to="/recruitment"
									className="h-[42px] box-border px-4 py-2 bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold rounded-lg transition-colors inline-flex items-center justify-center flex-shrink-0"
								>
									Roster
								</Link>
							</div>
						</div>
					</div>
				</div>
			</header>

			<main className="max-w-7xl mx-auto pt-24 pb-16 px-8">
				{filteredAthletes.length > 0 ? (
					<div className="relative">
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

						<div>
							<AthleteCard
								athlete={filteredAthletes[currentIndex]}
								setIsModalOpen={() => {}}
								setSelectedType={() => {}}
								setFormData={() => {}}
							/>
						</div>

						{filteredAthletes[currentIndex]?.id && (
							<div className="mt-12 space-y-8">
								<div className="mb-8">
									<h2 className="text-xl font-semibold text-white mb-4">AI Player Overview</h2>
									<div className="bg-white rounded-lg shadow-lg p-6">
										<PlayerOverview athleteId={filteredAthletes[currentIndex].id} />
									</div>
								</div>
								<div className="mb-8">
									<h2 className="text-xl font-semibold text-white mb-4">Performance Overview</h2>
									<div className="bg-white rounded-lg shadow-lg p-6">
										<AthleteComparisonChart id={filteredAthletes[currentIndex].id} />
									</div>
								</div>
								<div style={{ display: "none" }}>
									<NordBoard id={filteredAthletes[currentIndex].id} onHasData={setHasNordData} />
									<ForcePlate id={filteredAthletes[currentIndex].id} onHasData={setHasForcePlateData} />
								</div>
								{hasNordData && (
									<div className="bg-white rounded-lg shadow-lg p-6">
										<NordBoard id={filteredAthletes[currentIndex].id} />
									</div>
								)}
								{hasForcePlateData && (
									<div className="bg-white rounded-lg shadow-lg p-6">
										<ForcePlate id={filteredAthletes[currentIndex].id} />
									</div>
								)}
							</div>
						)}

						<div className="text-center mt-2 text-sm text-[#FFBF00]">
							{currentIndex + 1} / {filteredAthletes.length}
						</div>
					</div>
				) : (
					<div className="text-center text-gray-400">No alumni found matching your criteria.</div>
				)}
			</main>
		</div>
	);
}

export default Alumni;
