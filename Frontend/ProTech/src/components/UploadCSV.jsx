import { useRef, useState } from 'react';
import axios from 'axios';
import CombineUpload from './CombineUpload';

const UploadCSV = () => {
	const [file, setFile] = useState(null);
	const [fileName, setFileName] = useState('');
	const [uploadProgress, setUploadProgress] = useState(0);
	const [data, setData] = useState([]);
	const [error, setError] = useState('');
	const [uploadType, setUploadType] = useState('csv'); // 'csv' or 'combine'
	const fileInputRef = useRef(null);

	const onChangeFile = (e) => {
		const selectedFile = e.target.files[0];
		setFile(selectedFile);
		setFileName(selectedFile?.name || '');
		setError('');
	};

	const onSubmit = async (e) => {
		e.preventDefault();
		if (!file) {
			setError('Please select a file first.');
			return;
		}

		const formData = new FormData();
		formData.append('file', file);

		try {
			const response = await axios.post('http://localhost:5000/upload', formData, {
				headers: { 'Content-Type': 'multipart/form-data' },
				onUploadProgress: (e) => {
					setUploadProgress(Math.round((e.loaded / e.total) * 100));
				},
			});

			setData(response.data.data);
			setError('');
			setUploadProgress(0);
			fileInputRef.current.value = '';
		} catch (err) {
			setError(err.response?.data?.message || 'Upload failed');
			setUploadProgress(0);
		}
	};

	return (
		<div className="bg-white/5 border border-[#FFBF00]/20 rounded-lg p-6">
			<h2 className="text-xl font-semibold text-[#FFBF00] mb-4">Upload CSV or Excel File</h2>
			
			{/* Upload Type Selector */}
			<div className="flex gap-4 mb-6">
				<button
					type="button"
					onClick={() => setUploadType('csv')}
					className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
						uploadType === 'csv'
							? 'bg-[#FFBF00] text-[#022851]'
							: 'bg-white/10 text-white hover:bg-white/20'
					}`}
				>
					CSV/Excel Upload
				</button>
				<button
					type="button"
					onClick={() => setUploadType('combine')}
					className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
						uploadType === 'combine'
							? 'bg-[#FFBF00] text-[#022851]'
							: 'bg-white/10 text-white hover:bg-white/20'
					}`}
				>
					Combine Upload
				</button>
			</div>

			{uploadType === 'combine' ? (
				<CombineUpload />
			) : (
				<form onSubmit={onSubmit} className="space-y-4">
				<div className="flex items-center gap-4">
					<input
						type="file"
						accept=".csv, .xls, .xlsx"
						onChange={onChangeFile}
						ref={fileInputRef}
						className="px-4 py-2 bg-white/10 border border-[#FFBF00]/30 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFBF00] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#FFBF00] file:text-[#022851] hover:file:bg-[#FFD700] cursor-pointer"
					/>
					<button
						type="submit"
						disabled={!file}
						className="bg-[#FFBF00] hover:bg-[#FFD700] disabled:bg-gray-500 disabled:cursor-not-allowed text-[#022851] font-semibold px-4 py-2 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFBF00]"
					>
						Upload
					</button>
				</div>

				{uploadProgress > 0 && (
					<div className="mt-4">
						<div className="flex items-center gap-2">
							<div className="flex-1 bg-white/10 rounded-full h-2.5">
								<div
									className="bg-[#FFBF00] h-2.5 rounded-full transition-all duration-300"
									style={{ width: `${uploadProgress}%` }}
								></div>
							</div>
							<span className="text-sm text-[#FFBF00] font-medium">{uploadProgress}%</span>
						</div>
					</div>
				)}

				{error && (
					<div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-4">
						{error}
					</div>
				)}

				{data.length > 0 && (
					<div className="mt-6">
						<h3 className="text-lg font-semibold text-white mb-4">File Data Preview</h3>
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-[#FFBF00]/20 border border-[#FFBF00]/20">
								<thead className="bg-[#FFBF00]/10">
									<tr>
										{Object.keys(data[0]).map((key) => (
											<th
												key={key}
												className="px-6 py-3 text-left text-xs font-medium text-[#FFBF00] uppercase tracking-wider border-b border-[#FFBF00]/20"
											>
												{key}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="bg-white/5 divide-y divide-[#FFBF00]/20">
									{data.slice(0, 10).map((row, idx) => (
										<tr key={idx} className="hover:bg-[#FFBF00]/10">
											{Object.values(row).map((val, i) => (
												<td
													key={i}
													className="px-6 py-4 whitespace-nowrap text-sm text-gray-300"
												>
													{val}
												</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
							{data.length > 10 && (
								<p className="text-sm text-gray-400 mt-2">
									Showing first 10 rows of {data.length} total rows
								</p>
							)}
						</div>
					</div>
				)}
			</form>
			)}
		</div>
	);
};

export default UploadCSV;

