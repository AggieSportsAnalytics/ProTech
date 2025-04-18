import { useState } from "react";
import Modal from "react-modal";
import supabase from "../utils/supabase";
import Papa from "papaparse";

Modal.setAppElement("#root");

function AddDataModal({ isModalOpen, setIsModalOpen }) {
	const [selectedType, setSelectedType] = useState(null);

	const [formData, setFormData] = useState({});

	const handleClose = () => {
		setIsModalOpen(false);
		setSelectedType(null);
		setFormData({});
	};

	const handleChange = (e) => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		});
	};

	const handleCSVUpload = (e) => {
		const file = e.target.files[0];
		if (!file) return;

		Papa.parse(file, {
			header: true,
			skipEmptyLines: true,
			complete: async (results) => {
				try {
					const rows = results.data;

					const uniqueNames = [...new Set(rows.map((row) => row.name))];

					const { data: existingNames, error: fetchError } = await supabase
						.from("names")
						.select("name")
						.in("name", uniqueNames);

					if (fetchError) {
						return;
					}

					const existingNameSet = new Set(existingNames.map((n) => n.name));
					const missingNames = uniqueNames.filter(
						(name) => !existingNameSet.has(name),
					);

					if (missingNames.length > 0) {
						const { error: insertNamesError } = await supabase
							.from("names")
							.insert(missingNames.map((name) => ({ name })));
						if (insertNamesError) {
							return;
						}
					}

					if (selectedType === "nordboard") {
						const insertData = rows.map((row) => ({
							name: row.name,
							date: row.date,
							L_max_force_n: Number.parseFloat(row.L_max_force_n),
							R_max_force_n: Number.parseFloat(row.R_max_force_n),
							max_imbalance_percent: Number.parseFloat(
								row.max_imbalance_percent,
							),
						}));

						const { error } = await supabase
							.from("NordBoard")
							.insert(insertData);
						if (error) {
							return;
						}
					} else if (selectedType === "forceplate") {
						const insertData = rows.map((row) => ({
							name: row.name,
							date: row.date,
							rsi_modified_meters_sec: Number.parseFloat(
								row.rsi_modified_meters_sec,
							),
							jump_height_cm: Number.parseFloat(row.jump_height_cm),
							concentric_impulse_asym_percent_L: Number.parseFloat(
								row.concentric_impulse_asym_percent_L,
							),
							concentric_impulse_asym_percent_R: Number.parseFloat(
								row.concentric_impulse_asym_percent_R,
							),
							eccentric_deceleration_impulse_asym_percent_L: Number.parseFloat(
								row.eccentric_deceleration_impulse_asym_percent_L,
							),
							eccentric_deceleration_impulse_asym_percent_R: Number.parseFloat(
								row.eccentric_deceleration_impulse_asym_percent_R,
							),
							landing_impulse_asym_percent_L: Number.parseFloat(
								row.landing_impulse_asym_percent_L,
							),
							landing_impulse_asym_percent_R: Number.parseFloat(
								row.landing_impulse_asym_percent_R,
							),
						}));

						const { error } = await supabase
							.from("ForcePlate_Baseline")
							.insert(insertData);
						if (error) {
							return;
						}
					}

					alert("CSV uploaded and inserted successfully!");
					handleClose();
				} catch (err) {
					console.error("Error uploading CSV:", err.message);
					alert("Failed to upload CSV.");
				}
			},
		});
	};

	const submitData = async (e) => {
		e.preventDefault();
		try {
			const { data: existingNames, error: nameCheckError } = await supabase
				.from("names")
				.select("name")
				.eq("name", formData.name);

			if (nameCheckError) {
				return;
			}

			if (!existingNames || existingNames.length === 0) {
				const { error: insertNameError } = await supabase
					.from("names")
					.insert([{ name: formData.name }]);

				if (insertNameError) {
					return;
				}
			}

			if (selectedType === "nordboard") {
				const { error } = await supabase.from("NordBoard").insert([
					{
						name: formData.name,
						date: formData.date,
						L_max_force_n: Number.parseFloat(formData.L_max_force_n),
						R_max_force_n: Number.parseFloat(formData.R_max_force_n),
						max_imbalance_percent: Number.parseFloat(
							formData.max_imbalance_percent,
						),
					},
				]);
				if (error) {
					return;
				}
			} else if (selectedType === "forceplate") {
				const { error } = await supabase.from("ForcePlate_Baseline").insert([
					{
						name: formData.name,
						date: formData.date,
						rsi_modified_meters_sec: Number.parseFloat(
							formData.rsi_modified_meters_sec,
						),
						jump_height_cm: Number.parseFloat(formData.jump_height_cm),
						concentric_impulse_asym_percent_L: Number.parseFloat(
							formData.concentric_impulse_asym_percent_L,
						),
						concentric_impulse_asym_percent_R: Number.parseFloat(
							formData.concentric_impulse_asym_percent_R,
						),
						eccentric_deceleration_impulse_asym_percent_L: Number.parseFloat(
							formData.eccentric_deceleration_impulse_asym_percent_L,
						),
						eccentric_deceleration_impulse_asym_percent_R: Number.parseFloat(
							formData.eccentric_deceleration_impulse_asym_percent_R,
						),
						landing_impulse_asym_percent_L: Number.parseFloat(
							formData.landing_impulse_asym_percent_L,
						),
						landing_impulse_asym_percent_R: Number.parseFloat(
							formData.landing_impulse_asym_percent_R,
						),
					},
				]);
				if (error) {
					return;
				}
			}

			alert("Data submitted successfully!");
			handleClose();
		} catch (err) {
			console.error("Error inserting data:", err.message);
			alert("Failed to submit data.");
		}
	};

	return (
		<Modal
			isOpen={isModalOpen}
			onRequestClose={handleClose}
			className="bg-white rounded-lg p-8 w-[600px] max-h-[90vh] overflow-y-auto mx-auto my-20 shadow-lg border border-gray-300 outline-none"
			overlayClassName="fixed inset-0 bg-black/50 flex justify-center items-center"
		>
			<h2 className="text-2xl font-bold mb-6 text-gray-800">
				{selectedType
					? `Add ${selectedType === "nordboard" ? "NordBoard" : "ForcePlate"} Data`
					: "Choose an Option"}
			</h2>

			{!selectedType && (
				<div className="flex flex-col space-y-4">
					<button
						type="button"
						className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded text-center"
						onClick={() => setSelectedType("nordboard")}
					>
						NordBoard
					</button>
					<button
						type="button"
						className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded text-center"
						onClick={() => setSelectedType("forceplate")}
					>
						ForcePlate
					</button>
					<button
						type="button"
						onClick={handleClose}
						className="text-gray-500 hover:text-gray-700 mt-4"
					>
						Cancel
					</button>
				</div>
			)}

			{selectedType && (
				<form onSubmit={submitData} className="flex flex-col space-y-4">
					<input
						name="name"
						type="text"
						placeholder="Name"
						className="border border-gray-300 rounded px-4 py-2"
						onChange={handleChange}
						value={formData.name || ""}
					/>
					<input
						name="date"
						type="date"
						placeholder="Date"
						className="border border-gray-300 rounded px-4 py-2"
						onChange={handleChange}
						value={formData.date || ""}
					/>

					{selectedType === "nordboard" && (
						<>
							<input
								name="L_max_force_n"
								type="number"
								placeholder="L_max_force_n"
								className="border border-gray-300 rounded px-4 py-2"
								onChange={handleChange}
								value={formData.L_max_force_n || ""}
							/>
							<input
								name="R_max_force_n"
								type="number"
								placeholder="R_max_force_n"
								className="border border-gray-300 rounded px-4 py-2"
								onChange={handleChange}
								value={formData.R_max_force_n || ""}
							/>
							<input
								name="max_imbalance_percent"
								type="number"
								placeholder="Max Imbalance Percent"
								className="border border-gray-300 rounded px-4 py-2"
								onChange={handleChange}
								value={formData.max_imbalance_percent || ""}
							/>
							<div className="flex items-center space-x-4">
								<label
									htmlFor="file-upload"
									className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-md shadow-sm transition"
								>
									Upload CSV
								</label>
								<input
									id="file-upload"
									type="file"
									accept=".csv"
									onChange={handleCSVUpload}
									className="hidden"
								/>

								<a
									href="/example_nordboard.csv"
									download
									className="inline-flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md shadow-sm transition"
								>
									Download Example CSV
								</a>
							</div>
						</>
					)}

					{selectedType === "forceplate" && (
						<>
							<input
								name="rsi_modified_meters_sec"
								type="number"
								placeholder="RSI Modified (m/s)"
								className="border border-gray-300 rounded px-4 py-2"
								onChange={handleChange}
								value={formData.rsi_modified_meters_sec || ""}
							/>
							<input
								name="jump_height_cm"
								type="number"
								placeholder="Jump Height (cm)"
								className="border border-gray-300 rounded px-4 py-2"
								onChange={handleChange}
								value={formData.jump_height_cm || ""}
							/>
							<input
								name="concentric_impulse_asym_percent_L"
								type="number"
								placeholder="Concentric Impulse Asymmetry Left (%)"
								className="border border-gray-300 rounded px-4 py-2"
								onChange={handleChange}
								value={formData.concentric_impulse_asym_percent_L || ""}
							/>
							<input
								name="concentric_impulse_asym_percent_R"
								type="number"
								placeholder="Concentric Impulse Asymmetry Right (%)"
								className="border border-gray-300 rounded px-4 py-2"
								onChange={handleChange}
								value={formData.concentric_impulse_asym_percent_R || ""}
							/>
							<input
								name="eccentric_deceleration_impulse_asym_percent_L"
								type="number"
								placeholder="Eccentric Deceleration Asymmetry Left (%)"
								className="border border-gray-300 rounded px-4 py-2"
								onChange={handleChange}
								value={
									formData.eccentric_deceleration_impulse_asym_percent_L || ""
								}
							/>
							<input
								name="eccentric_deceleration_impulse_asym_percent_R"
								type="number"
								placeholder="Eccentric Deceleration Asymmetry Right (%)"
								className="border border-gray-300 rounded px-4 py-2"
								onChange={handleChange}
								value={
									formData.eccentric_deceleration_impulse_asym_percent_R || ""
								}
							/>
							<input
								name="landing_impulse_asym_percent_L"
								type="number"
								placeholder="Landing Impulse Asymmetry Left (%)"
								className="border border-gray-300 rounded px-4 py-2"
								onChange={handleChange}
								value={formData.landing_impulse_asym_percent_L || ""}
							/>
							<input
								name="landing_impulse_asym_percent_R"
								type="number"
								placeholder="Landing Impulse Asymmetry Right (%)"
								className="border border-gray-300 rounded px-4 py-2"
								onChange={handleChange}
								value={formData.landing_impulse_asym_percent_R || ""}
							/>
							<div>
								<div className="flex items-center space-x-4">
									<label
										htmlFor="file-upload"
										className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-md shadow-sm transition"
									>
										Upload CSV
									</label>
									<input
										id="file-upload"
										type="file"
										accept=".csv"
										onChange={handleCSVUpload}
										className="hidden"
									/>

									<a
										href="/example_forceplate.csv"
										download
										className="inline-flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md shadow-sm transition"
									>
										Download Example CSV
									</a>
								</div>
							</div>
						</>
					)}

					<div className="flex space-x-4 pt-4">
						<button
							type="submit"
							className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
						>
							Submit
						</button>
						<button
							type="button"
							onClick={handleClose}
							className="text-gray-500 hover:text-gray-700"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => setSelectedType(null)}
							className="text-gray-500 hover:text-gray-700"
						>
							Back
						</button>
					</div>
				</form>
			)}
		</Modal>
	);
}

export default AddDataModal;
