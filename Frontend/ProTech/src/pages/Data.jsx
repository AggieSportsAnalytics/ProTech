import { useState, useEffect } from "react";
import supabase from "../utils/supabase";
import Loader from "../components/Loader";
import AddDataModal from "../components/AddDataModal";
import DropdownFilter from "../components/DropdownFilter";
import { FiSearch, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

function Data() {
	const [data, setData] = useState([]);
	const [copied, setCopied] = useState({});
	const [filteredData, setFilteredData] = useState([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedPosition, setSelectedPosition] = useState("All Positions");
	const navigate = useNavigate();

	// Function to capitalize position names
	const capitalizePosition = (pos) => {
		return pos.split(" ").map(word => 
			word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
		).join(" ");
	};

	const handleDelete = async (id) => {
		try {
			const confirmed = window.confirm(
				"Are you sure you want to delete this athlete and all their data? This action is irreversible.",
			);

			if (!confirmed) {
				setLoading(false);
				return;
			}

			const { error: namesError } = await supabase
				.from("names")
				.delete()
				.eq("id", id);
			if (namesError) {
				throw new Error("Failed to delete");
			}

			// Remove deleted athlete from state
			setData((prevData) => prevData.filter((item) => item.id !== id));
			setFilteredData((prevData) => prevData.filter((item) => item.id !== id));

			alert("Deleted successfully!");
		} catch (err) {
			console.error("Error deleting:", err.message);
			alert("Failed to delete.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const getAllNames = async () => {
			setLoading(true);
			const { data, error } = await supabase.from("names").select("*");

			if (error) {
				console.error("Supabase error:", error);
				setError(error.message);
			} else if (data) {
				setData(data);
				setFilteredData(data);
			} else {
				console.error("Error fetching names:", error);
				setData([]);
				setFilteredData([]);
			}

			setLoading(false);
		};

		getAllNames();
	}, []);

	// Handle search and position filter functionality
	useEffect(() => {
		let filtered = data;

		// Apply search filter
		if (searchQuery.trim() !== "") {
			filtered = filtered.filter((item) =>
				item.name.toLowerCase().includes(searchQuery.toLowerCase()),
			);
		}

		// Apply position filter
		if (selectedPosition !== "All Positions") {
			filtered = filtered.filter((item) =>
				item.position.toLowerCase() === selectedPosition.toLowerCase()
			);
		}

		setFilteredData(filtered);
	}, [searchQuery, selectedPosition, data]);

	if (error) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
					<div className="flex">
						<div className="flex-shrink-0">
							<svg
								className="h-5 w-5 text-red-500"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fillRule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
									clipRule="evenodd"
								/>
							</svg>
						</div>
						<div className="ml-3">
							<p className="text-sm text-red-600">Error: {error}</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<>
			<div className="bg-white shadow-sm border-b border-gray-200">
				<div className="max-w-7xl mx-auto px-8 py-4">
						<div className="flex items-center justify-between">
							<h1 
								onClick={() => window.location.href = '/'}
								className="text-2xl font-bold text-[#0B1340] cursor-pointer hover:text-[#B4975A] transition-colors"
							>
								ProTech
							</h1>

							{/* Add Button */}
							<button
								onClick={() => setIsModalOpen(true)}
								type="button"
								className="bg-[#B4975A] hover:bg-[#8B7443] text-white rounded-lg px-4 py-2 text-sm transition-colors duration-200 flex items-center"
							>
								<span className="mr-1">+</span>
								Add
							</button>
						</div>
				</div>
			</div>

			<div className="max-w-3xl mx-auto px-4 py-6">
				{/* Search and Filter Section */}
				<div className="mb-8">
					<div className="bg-white rounded-lg shadow-sm p-4">
						<div className="flex flex-col space-y-4">
							{/* Search Bar */}
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
									<FiSearch className="h-5 w-5 text-gray-400" />
								</div>
								<input
									type="text"
									className="block w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-lg focus:ring-[#0B1340] focus:border-[#0B1340] text-lg"
									placeholder="Search athletes by name..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
								/>
							</div>

							{/* Position Filter */}
							<DropdownFilter
								selectedPosition={selectedPosition}
								onPositionChange={setSelectedPosition}
							/>
						</div>
					</div>
				</div>

				{loading ? (
					<div className="flex justify-center items-center h-64">
						<Loader />
					</div>
				) : filteredData.length === 0 ? (
					<div className="bg-gray-50 rounded-lg p-8 text-center">
						<FiUser className="mx-auto h-12 w-12 text-gray-400" />
						<h3 className="mt-2 text-sm font-medium text-gray-900">
							No athletes found
						</h3>
						<p className="mt-1 text-sm text-gray-500">
							{searchQuery || selectedPosition !== "All Positions"
								? "No results match your search criteria."
								: "Get started by adding a new athlete."}
						</p>
						<div className="mt-6">
							<button
								type="button"
								onClick={() => setIsModalOpen(true)}
								className="inline-flex items-center px-6 py-3 border-2 border-[#0B1340] text-lg font-medium rounded-lg text-[#0B1340] hover:bg-[#0B1340] hover:text-white transition-colors"
							>
								<span className="mr-2">+</span>
								Add Athlete
							</button>
						</div>
					</div>
				) : (
					<div className="space-y-4">
						{filteredData.map((item) => (
							<div
								key={item.id}
								className="group bg-white rounded-lg border-2 border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-200 hover:border-[#B4975A]"
							>
								<div
									onClick={() => navigate(`/data/${item.id}`)}
									className="p-4 cursor-pointer"
								>
									<div className="flex flex-col">
										<h3 className="text-lg font-semibold text-[#0B1340] truncate">
											{item.name}
										</h3>
										<p className="text-sm text-gray-500">
											{capitalizePosition(item.position)}
										</p>
										</div>
									</div>
								</div>
							))}
					</div>
				)}

				<AddDataModal
					isModalOpen={isModalOpen}
					setIsModalOpen={setIsModalOpen}
				/>
			</div>
		</>
	);
}

export default Data;
