import { useState, useEffect } from "react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	Tooltip,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
} from "recharts";
import supabase from "../utils/supabase";
import Loader from "./Loader";

function NordBoard({ id, onHasData }) {
	const [nordData, setNordData] = useState([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [athleteName, setAthleteName] = useState("");
	const [activeForm, setActiveForm] = useState(null);
	const [activeRemoveView, setActiveRemoveView] = useState(null);
	const [formDate, setFormDate] = useState("");
	const [formValue, setFormValue] = useState("");
	const [formError, setFormError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const fetchAthleteName = async () => {
		if (!id) return;
		const { data } = await supabase
			.from("names")
			.select("name")
			.eq("id", id)
			.single();
		if (data?.name) {
			setAthleteName(data.name);
			return data.name;
		}
		return "";
	};

	const fetchNordData = async () => {
		setLoading(true);
		const { data, error } = await supabase
			.from("NordBoard")
			.select("*")
			.eq("id", id);

		if (error) {
			console.error("Supabase error:", error);
			setError(error.message);
			if (onHasData) onHasData(false);
		} else if (data) {
			const sortedData = data.sort(
				(a, b) => new Date(a.date) - new Date(b.date),
			);
			setNordData(sortedData);
			if (sortedData[0]?.name) {
				setAthleteName(sortedData[0].name);
			}
			if (onHasData) onHasData(sortedData.length > 0);
		} else {
			console.error("Error getting nordboard data:", error);
			setNordData([]);
			if (onHasData) onHasData(false);
		}
		setLoading(false);
	};

	useEffect(() => {
		if (id) {
			fetchNordData();
		}
	}, [id, onHasData]);

	useEffect(() => {
		if (!athleteName && id) {
			fetchAthleteName();
		}
	}, [athleteName, id]);

	const closeForm = () => {
		setActiveForm(null);
		setFormDate("");
		setFormValue("");
		setFormError("");
	};

	const handleDeleteData = async (date, field) => {
		if (!confirm(`Are you sure you want to delete the ${field} data for ${date}?`)) {
			return;
		}

		setIsDeleting(true);
		try {
			// Get the entry to check if it has other fields
			const entry = nordData.find((e) => e.date === date);
			
			if (!entry) {
				throw new Error("Entry not found");
			}

			// Check if entry has other non-null fields
			const otherFields = ['L_max_force_n', 'R_max_force_n', 'max_imbalance_percent'].filter(
				(f) => f !== field && entry[f] !== null && entry[f] !== undefined
			);

			if (otherFields.length > 0) {
				// Update the entry to set this field to null
				const { error } = await supabase
					.from("NordBoard")
					.update({ [field]: null })
					.eq("id", id)
					.eq("date", date);

				if (error) throw error;
			} else {
				// Delete the entire entry if no other fields exist
				const { error } = await supabase
					.from("NordBoard")
					.delete()
					.eq("id", id)
					.eq("date", date);

				if (error) throw error;
			}

			await fetchNordData();
			setActiveRemoveView(null);
		} catch (err) {
			console.error("Error deleting data:", err);
			alert(err.message || "Failed to delete data.");
		} finally {
			setIsDeleting(false);
		}
	};

	const renderRemoveView = (field, label) => {
		if (activeRemoveView !== field) return null;

		const fieldData = nordData
			.filter((entry) => entry[field] !== null && entry[field] !== undefined)
			.map((entry) => ({
				date: entry.date,
				value: entry[field],
			}))
			.sort((a, b) => new Date(a.date) - new Date(b.date));

		return (
			<div className="bg-white/10 border border-[#FFBF00]/30 rounded-lg p-4 mb-6">
				<p className="text-sm font-semibold text-white mb-4">
					Remove {label} data points
				</p>
				{fieldData.length > 0 ? (
					<div className="space-y-2 max-h-60 overflow-y-auto">
						{fieldData.map((item, index) => (
							<div
								key={index}
								className="flex justify-between items-center bg-white/5 rounded px-3 py-2 hover:bg-white/10 transition-colors"
							>
								<div className="text-white">
									<span className="font-medium">{item.date}</span>
									<span className="ml-3 text-gray-300">: {item.value}</span>
								</div>
								<button
									type="button"
									onClick={() => handleDeleteData(item.date, field)}
									disabled={isDeleting}
									className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
								>
									Remove
								</button>
							</div>
						))}
					</div>
				) : (
					<p className="text-gray-400 text-sm">No data points to remove</p>
				)}
				<button
					type="button"
					onClick={() => setActiveRemoveView(null)}
					className="mt-4 border border-white/40 text-white px-4 py-2 rounded-lg text-sm"
				>
					Close
				</button>
			</div>
		);
	};

	const handleSavePoint = async (field) => {
		if (!formDate || formValue === "") {
			setFormError("Please provide both a date and a value.");
			return;
		}

		const numericValue = Number(formValue);
		if (Number.isNaN(numericValue)) {
			setFormError("Value must be a valid number.");
		 return;
		}

		setIsSubmitting(true);
		setFormError("");

		try {
			const existingEntry = nordData.find((entry) => entry.date === formDate);
			let nameToUse = existingEntry?.name || athleteName;
			if (!nameToUse) {
				nameToUse = await fetchAthleteName();
			}

			const payload = existingEntry
				? { ...existingEntry, [field]: numericValue }
				: {
						id,
						name: nameToUse,
						date: formDate,
						L_max_force_n: null,
						R_max_force_n: null,
						max_imbalance_percent: null,
						[field]: numericValue,
				  };

			const { error } = existingEntry
				? await supabase
						.from("NordBoard")
						.update({ [field]: numericValue })
						.eq("id", id)
						.eq("date", formDate)
				: await supabase.from("NordBoard").insert([payload]);

			if (error) {
				throw error;
			}

			closeForm();
			await fetchNordData();
		} catch (err) {
			console.error("Error saving NordBoard data:", err);
			setFormError(err.message || "Failed to save data.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const renderForm = (field, label) =>
		activeForm === field && (
			<div className="bg-white/10 border border-[#FFBF00]/30 rounded-lg p-4 mb-6">
				<p className="text-sm font-semibold text-white mb-2">
					Add {label} data point
				</p>
				<div className="flex flex-col gap-3 md:flex-row">
					<input
						type="date"
						className="border border-gray-300 rounded px-3 py-2 text-sm"
						value={formDate}
						onChange={(e) => setFormDate(e.target.value)}
					/>
					<input
						type="number"
						step="any"
						className="border border-gray-300 rounded px-3 py-2 text-sm"
						value={formValue}
						onChange={(e) => setFormValue(e.target.value)}
						placeholder="Value"
					/>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => handleSavePoint(field)}
							className="bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
							disabled={isSubmitting}
						>
							{isSubmitting ? "Saving..." : "Save"}
						</button>
						<button
							type="button"
							onClick={closeForm}
							className="border border-white/40 text-white px-4 py-2 rounded-lg"
						>
							Cancel
						</button>
					</div>
				</div>
				{formError && <p className="text-sm text-red-400 mt-2">{formError}</p>}
			</div>
		);

	if (error) {
		return <div className="p-8 text-red-600">Error: {error}</div>;
	}

	if (loading) {
		return <Loader />;
	}

	const hasLeftForce = nordData.some(
		(entry) => entry.L_max_force_n !== null && entry.L_max_force_n !== undefined,
	);
	const hasRightForce = nordData.some(
		(entry) => entry.R_max_force_n !== null && entry.R_max_force_n !== undefined,
	);

	return (
		<>
			<h1 className="text-2xl font-bold mb-6">
				{nordData?.length > 0 && <p>NordBoard Data for {nordData[0].name}</p>}
			</h1>
			{nordData.length > 0 ? (
				<>
					<div className="relative mb-8">
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold">Max Imbalance %</h2>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => {
										setActiveForm("max_imbalance_percent");
										setActiveRemoveView(null);
										setFormDate("");
										setFormValue("");
										setFormError("");
									}}
									className="bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
								>
									Add Data
								</button>
								<button
									type="button"
									onClick={() => {
										setActiveRemoveView("max_imbalance_percent");
										setActiveForm(null);
									}}
									className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
								>
									Remove Data
								</button>
							</div>
						</div>
						{renderForm("max_imbalance_percent", "Max Imbalance %")}
						{renderRemoveView("max_imbalance_percent", "Max Imbalance %")}
						<ResponsiveContainer width="100%" height={300}>
							<LineChart data={nordData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="date" />
								<YAxis
									label={{
										value: "Imbalance (%)",
										angle: -90,
										position: "insideLeft",
									}}
								/>
								<Tooltip />
								<Legend />
								<Line
									type="monotone"
									dataKey="max_imbalance_percent"
									stroke="#8884d8"
									name="Max Imbalance %"
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>

					{hasRightForce ? (
						<div className="relative mb-8">
							<div className="flex justify-between items-center mb-4">
								<h2 className="text-xl font-semibold">Right Max Force (N)</h2>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => {
											setActiveForm("R_max_force_n");
											setActiveRemoveView(null);
											setFormDate("");
											setFormValue("");
											setFormError("");
										}}
										className="bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
									>
										Add Data
									</button>
									<button
										type="button"
										onClick={() => {
											setActiveRemoveView("R_max_force_n");
											setActiveForm(null);
										}}
										className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
									>
										Remove Data
									</button>
								</div>
							</div>
							{renderForm("R_max_force_n", "Right Max Force")}
							{renderRemoveView("R_max_force_n", "Right Max Force")}
							<ResponsiveContainer width="100%" height={300}>
								<LineChart data={nordData}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="date" />
									<YAxis
										label={{
											value: "Force (N)",
											angle: -90,
											position: "insideLeft",
										}}
									/>
									<Tooltip />
									<Legend />
									<Line
										type="monotone"
										dataKey="R_max_force_n"
										stroke="#82ca9d"
										name="Right Max Force"
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
					) : (
						<div className="bg-white/10 border border-[#FFBF00]/10 rounded-lg py-10 text-center text-gray-300 mb-8">
							No Right Max Force data available
						</div>
					)}

					{hasLeftForce ? (
						<div className="relative mb-8">
							<div className="flex justify-between items-center mb-4">
								<h2 className="text-xl font-semibold">Left Max Force (N)</h2>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => {
											setActiveForm("L_max_force_n");
											setActiveRemoveView(null);
											setFormDate("");
											setFormValue("");
											setFormError("");
										}}
										className="bg-[#FFBF00] hover:bg-[#FFD700] text-[#022851] font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
									>
										Add Data
									</button>
									<button
										type="button"
										onClick={() => {
											setActiveRemoveView("L_max_force_n");
											setActiveForm(null);
										}}
										className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
									>
										Remove Data
									</button>
								</div>
							</div>
							{renderForm("L_max_force_n", "Left Max Force")}
							{renderRemoveView("L_max_force_n", "Left Max Force")}
							<ResponsiveContainer width="100%" height={300}>
								<LineChart data={nordData}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="date" />
									<YAxis
										label={{
											value: "Force (N)",
											angle: -90,
											position: "insideLeft",
										}}
									/>
									<Tooltip />
									<Legend />
									<Line
										type="monotone"
										dataKey="L_max_force_n"
										stroke="#ff7300"
										name="Left Max Force"
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
					) : (
						<div className="bg-white/10 border border-[#FFBF00]/10 rounded-lg py-10 text-center text-gray-300 mb-8">
							No Left Max Force data available
						</div>
					)}
				</>
			) : (
				<div className="flex items-center justify-center py-12">
					<p className="text-gray-500 text-lg">No data available</p>
				</div>
			)}
		</>
	);
}

export default NordBoard;
