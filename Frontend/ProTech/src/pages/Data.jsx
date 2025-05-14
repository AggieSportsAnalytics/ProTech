import { useState, useEffect } from "react";
import supabase from "../utils/supabase";
import Loader from "../components/Loader";
import AddDataModal from "../components/AddDataModal";
import { FiTrash2, FiSearch, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

function Data() {
	const [data, setData] = useState([]);
	const [copied, setCopied] = useState({});
	const [filteredData, setFilteredData] = useState([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const navigate = useNavigate();

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

	// Handle search functionality
	useEffect(() => {
		if (searchQuery.trim() === "") {
			setFilteredData(data);
		} else {
			const filtered = data.filter((item) =>
				item.name.toLowerCase().includes(searchQuery.toLowerCase()),
			);
			setFilteredData(filtered);
		}
	}, [searchQuery, data]);

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
		<div className="max-w-6xl mx-auto p-6">
			<div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
				<h1 className="text-3xl font-bold text-gray-800 mb-4 md:mb-0">
					Athletes
				</h1>

				{/* Search Bar */}
				<div className="relative w-full md:w-64">
					<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<FiSearch className="h-5 w-5 text-gray-400" />
					</div>
					<input
						type="text"
						className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
						placeholder="Search athletes..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
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
						{searchQuery
							? "No results match your search query."
							: "Get started by adding a new athlete."}
					</p>
					<div className="mt-6">
						<button
							type="button"
							onClick={() => setIsModalOpen(true)}
							className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
						>
							<span className="mr-2">+</span>
							Add athlete
						</button>
					</div>
				</div>
			) : (
				<div className="bg-white shadow rounded-lg overflow-hidden">
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
						{filteredData.map((item) => (
							<div
								key={item.id}
								className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 hover:border-blue-300"
							>
								<div
									onClick={() =>
										navigate(`/data/${item.name.replaceAll(" ", "-")}`)
									}
									className="p-4 cursor-pointer"
								>
									<div className="flex items-center">
										<div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
											<span className="text-blue-600 font-semibold">
												{item.name.charAt(0).toUpperCase()}
											</span>
										</div>
										<div>
											<h3 className="text-lg font-medium text-gray-900 truncate">
												{item.name}
											</h3>
											<div
												className="pt-2 text-xs text-gray-500"
												onClick={(e) => {
													e.stopPropagation();
													navigator.clipboard.writeText(item.id);
													setCopied((prev) => ({ ...prev, [item.id]: true }));
													setTimeout(() => {
														setCopied((prev) => ({
															...prev,
															[item.id]: false,
														}));
													}, 1000);
												}}
											>
												{!copied?.[item.id] ? (
													<p>Click to Copy ID: {item.id}</p>
												) : (
													<p>Copied!</p>
												)}
											</div>
										</div>
									</div>
								</div>
								<button
									type="button"
									className="absolute top-0 right-2 p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-gray-100"
									onClick={(e) => {
										e.stopPropagation();
										e.preventDefault();
										setLoading(true);
										handleDelete(item.id);
									}}
								>
									<FiTrash2 size={16} />
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			<button
				onClick={() => setIsModalOpen(true)}
				type="button"
				className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
			>
				<span className="text-3xl">+</span>
			</button>
			<AddDataModal isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} />
		</div>
	);
}

export default Data;
