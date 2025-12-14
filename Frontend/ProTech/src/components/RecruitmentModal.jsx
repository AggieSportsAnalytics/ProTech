import { useState } from "react";
import Modal from "react-modal";
import supabase from "../utils/supabase";
// import Papa from "papaparse";
import Loader from "../components/Loader";
import { v4 as uuidv4 } from "uuid";
import { FiUpload, FiX } from "react-icons/fi";
import { FaSave } from "react-icons/fa";

Modal.setAppElement("#root");

function RecruitmentModal({ isModalOpen, setIsModalOpen, selectedType, setSelectedType, formData, setFormData }) {
	const [loading, setLoading] = useState(false);
	const [imagePreview, setImagePreview] = useState(null);
	const [athleteImage, setAthleteImage] = useState(null);

	const handleClose = () => {
		setIsModalOpen(false);
		setSelectedType(null);
		setFormData({});
		setImagePreview(null);
		setAthleteImage(null);
	};

	const handleChange = (e) => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		});
	};

	// const handleCSVUpload = (e) => {};

	const submitNewData = async (e) => {
		e.preventDefault();
		setLoading(true);

		setIsModalOpen(false);
		setSelectedType(null);

		const stats = [
			{
				year: Number(formData.year),
				lDrill: formData.lDrill || "NT",
				tenYard: formData.tenYardDash,
				backSquat: formData.backSquat,
				broadJump: formData.broadJump,
				flyingTen: formData.flying10,
				fortyYard: formData.fortyYardDash,
				hangClean: formData.hangClean,
				bodyWeight: formData.bodyWeight,
				proAgility: formData.proAgility,
				inclineBench: formData.inclineBench,
				verticalJump: formData.verticalJump,
			},
		];

		const id = uuidv4();

		const row = {
			id: id,
			name: formData.name,
			position: formData.position?.toLowerCase(),
			height: formData.height,
			wing: formData.wing,
			hand: formData.hand,
			stats,
		};

		const { data: d, error: err } = await supabase
			.from("Athlete_Data")
			.select("name")
			.eq("name", formData.name);

		if (d.length > 0) {
			setLoading(false);
			setImagePreview(null);
			setFormData({});
			setAthleteImage(null);
			window.alert(`User ${formData.name} exists, please use update`);
			return;
		}

		const { error: er } = await supabase
			.from("names")
			.insert([{ name: formData.name, id: id, position: formData.position }]);

		if (er) {
			setLoading(false);
			setImagePreview(null);
			setFormData({});
			setAthleteImage(null);
			window.alert(`Failed to create player ${formData.name}`);
			return;
		}

		const { data, error } = await supabase.from("Athlete_Data").insert([row]);

		if (error) {
			setLoading(false);
			setImagePreview(null);
			setFormData({});
			setAthleteImage(null);
			window.alert("Failed to upload data");
			return;
		}

		window.alert("Successfully uploaded data");

		if (athleteImage && formData.year) {
			// Get the name from names database to construct folder name
			const { data: nameData, error: nameError } = await supabase
				.from("names")
				.select("name")
				.eq("id", id)
				.single();

			if (nameError) {
				console.error("Error fetching name for folder:", nameError);
			} else {
				// Construct folder name: "Player Name-UUID"
				const sanitizedName = nameData.name.replace(/[<>:"/\\|?*]/g, '-').trim();
				const folderName = `${sanitizedName}-${id}`;
				
				const { error } = await supabase.storage
					.from("athlete-images")
					.upload(`${folderName}/${formData.year}.jpg`, athleteImage, {
						cacheControl: "3600",
						upsert: true,
					});

				if (error) {
					console.error("Image upload error:", error);
				}
			}
		}

		setLoading(false);
		setImagePreview(null);
		setFormData({});
		setAthleteImage(null);
	};

	const submitEditData = async (e) => {
		e.preventDefault();
		setLoading(true);

		const { data, error: selectError } = await supabase
			.from("Athlete_Data")
			.select("stats")
			.eq("id", formData.id)
			.single();

		if (selectError) {
			console.error("fetch stats failed:", selectError);
			window.alert("Failed to load existing data");
			setLoading(false);
			return;
		}

		const newStats = {
			year: Number(formData.year),
			lDrill: formData.lDrill || "NT",
			tenYard: formData.tenYardDash,
			backSquat: formData.backSquat,
			broadJump: formData.broadJump,
			flyingTen: formData.flying10,
			fortyYard: formData.fortyYardDash,
			hangClean: formData.hangClean,
			bodyWeight: formData.bodyWeight,
			proAgility: formData.proAgility,
			inclineBench: formData.inclineBench,
			verticalJump: formData.verticalJump,
		};

		const updatedStats = data.stats ? [...data.stats, newStats] : [newStats];

		const { error: updateError } = await supabase
			.from("Athlete_Data")
			.update({ stats: updatedStats })
			.eq("id", formData.id);

		if (updateError) {
			console.error("update failed:", updateError);
			window.alert("Failed to update player");
			setLoading(false);
			return;
		}

		window.alert("Successfully updated data");
		setIsModalOpen(false);
		setSelectedType(null);

		if (athleteImage && formData.year) {
			// Get the name from names database to construct folder name
			const { data: nameData, error: nameError } = await supabase
				.from("names")
				.select("name")
				.eq("id", formData.id)
				.single();

			if (nameError) {
				console.error("Error fetching name for folder:", nameError);
			} else {
				// Construct folder name: "Player Name-UUID"
				const sanitizedName = nameData.name.replace(/[<>:"/\\|?*]/g, '-').trim();
				const folderName = `${sanitizedName}-${formData.id}`;
				
				const { error: imgError } = await supabase.storage
					.from("athlete-images")
					.upload(`${folderName}/${formData.year}.jpg`, athleteImage, {
						cacheControl: "3600",
						upsert: true,
					});
				if (imgError) console.error("image upload failed:", imgError);
			}
		}

		setLoading(false);
		setImagePreview(null);
		setFormData({});
		setAthleteImage(null);
	};

	const handleImageChange = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const previewUrl = URL.createObjectURL(file);
		setImagePreview(previewUrl);

		setAthleteImage(file);
	};

	if (loading) {
		return <Loader />;
	}

	return (
		<Modal
			isOpen={isModalOpen}
			onRequestClose={handleClose}
			className="bg-white rounded-lg p-8 w-[600px] max-h-[90vh] overflow-y-auto mx-auto my-20 shadow-lg border border-gray-300 outline-none"
			overlayClassName="z-50 fixed inset-0 bg-black/50 flex justify-center items-center"
		>
			<h2 className="text-2xl font-bold mb-6 text-gray-800">
				{selectedType
					? `${selectedType === "edit" ? "Add Year" : "Add Player"}`
					: "Choose an Option"}
			</h2>

			{!selectedType && (
				<div className="flex flex-col space-y-4">
					<button
						type="button"
						className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded text-center"
						onClick={() => setSelectedType("edit")}
					>
						Edit
					</button>
					<button
						type="button"
						className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded text-center"
						onClick={() => setSelectedType("new")}
					>
						New
					</button>
				</div>
			)}

			{selectedType && (
				<form
					onSubmit={selectedType === "new" ? submitNewData : submitEditData}
				>
					{selectedType === "new" ? (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Name
								</label>
								<input
									type="text"
									name="name"
									value={formData.name || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									required
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Position
								</label>
								<input
									type="text"
									name="position"
									value={formData.position || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									required
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Height
								</label>
								<input
									type="text"
									name="height"
									value={formData.height || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									placeholder="e.g. 5'9"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Wing
								</label>
								<input
									type="text"
									name="wing"
									value={formData.wing || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									placeholder="e.g. 5'10.75"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Hand
								</label>
								<input
									type="text"
									name="hand"
									value={formData.hand || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									placeholder="e.g. 9.0"
								/>
							</div>
						</div>
					) : (
						<div className="mb-2">
							<label className="block text-sm font-medium text-gray-700 mb-1">
								id
							</label>
							<input
								name="id"
								value={formData.id || ""}
								onChange={handleChange}
								className="w-full p-2 border rounded"
								required
							/>
						</div>
					)}

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Year
						</label>
						<input
							type="number"
							name="year"
							value={formData.year || ""}
							onChange={handleChange}
							className="w-full p-2 border rounded"
							min="2000"
							max="2099"
							required
						/>
					</div>

					<div className="mb-4">
						<h4 className="font-medium text-lg mb-2">Physical Stats</h4>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Body Weight
								</label>
								<input
									type="text"
									name="bodyWeight"
									value={formData.bodyWeight || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									placeholder="e.g. 170 lbs"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Vertical Jump
								</label>
								<input
									type="text"
									name="verticalJump"
									value={formData.verticalJump || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									placeholder="e.g. 30.0"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Broad Jump
								</label>
								<input
									type="text"
									name="broadJump"
									value={formData.broadJump || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									placeholder="e.g. 9'6.5"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									10-Yard Dash
								</label>
								<input
									type="text"
									name="tenYardDash"
									value={formData.tenYardDash || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									placeholder="e.g. 1.57s"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Flying 10
								</label>
								<input
									type="text"
									name="flying10"
									value={formData.flying10 || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									placeholder="e.g. 1.15s"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									40-Yard Dash
								</label>
								<input
									type="text"
									name="fortyYardDash"
									value={formData.fortyYardDash || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									placeholder="e.g. 4.75s"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Pro Agility
								</label>
								<input
									type="text"
									name="proAgility"
									value={formData.proAgility || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									placeholder="e.g. 4.41s"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									L-Drill
								</label>
								<input
									type="text"
									name="lDrill"
									value={formData.lDrill || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									placeholder="e.g. 7.14s"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Hang Clean
								</label>
								<input
									type="text"
									name="hangClean"
									value={formData.hangClean || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									placeholder="e.g. 242 lbs"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Back Squat
								</label>
								<input
									type="text"
									name="backSquat"
									value={formData.backSquat || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									placeholder="e.g. 355 lbs"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Incline Bench
								</label>
								<input
									type="text"
									name="inclineBench"
									value={formData.inclineBench || ""}
									onChange={handleChange}
									className="w-full p-2 border rounded"
									placeholder="e.g. 220 lbs"
								/>
							</div>
						</div>
					</div>

					<div className="mb-6">
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Player Image
						</label>
						<div className="flex items-center space-x-4">
							<label className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
								<div className="space-y-1 text-center">
									<FiUpload size={24} className="mx-auto text-gray-400" />
									<div className="text-xs text-gray-500">Upload Image</div>
								</div>
								<input
									type="file"
									className="hidden"
									accept="image/jpeg"
									onChange={handleImageChange}
								/>
							</label>

							{imagePreview && (
								<div className="relative">
									<img
										src={imagePreview}
										alt="Preview"
										className="w-32 h-32 object-cover rounded-lg"
									/>
									<button
										type="button"
										className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
										onClick={() => {
											setImage(null);
											setImagePreview(null);
										}}
									>
										<FiX size={16} />
									</button>
								</div>
							)}
						</div>
					</div>

					<div className="flex justify-end space-x-4">
						<button
							type="button"
							className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
							onClick={() => setSelectedType(null)}
						>
							Back
						</button>
						<button
							type="submit"
							className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 flex items-center"
							disabled={loading}
						>
							{loading ? (
								<Loader />
							) : (
								<>
									<FaSave size={16} className="mr-2" />
									{selectedType === "new" ? "Add Player" : "Update Player"}
								</>
							)}
						</button>
					</div>
				</form>
			)}
		</Modal>
	);
}

export default RecruitmentModal;
