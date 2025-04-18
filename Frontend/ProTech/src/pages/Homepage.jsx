import React from "react";

function Dashboard() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-6">
			<header className="mb-12 text-center">
				<h1 className="text-5xl font-extrabold text-blue-700 mb-4 drop-shadow-lg">
					ProTech Athlete Management
				</h1>
				<p className="text-lg text-gray-600">
					Centralized Platform for Athlete Performance and Data
				</p>
			</header>

			<div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
				<div className="bg-white rounded-3xl shadow-xl hover:shadow-2xl transition p-8 flex flex-col justify-between">
					<div>
						<h2 className="text-2xl font-bold mb-3 text-blue-800">
							Athlete Directory
						</h2>
						<p className="text-gray-600">
							View, search, and manage all registered athletes.
						</p>
					</div>
					<a
						href="/recruitment"
						className="mt-6 inline-block text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-xl transition"
					>
						Go to Athletes
					</a>
				</div>

				<div className="bg-white rounded-3xl shadow-xl hover:shadow-2xl transition p-8 flex flex-col justify-between">
					<div>
						<h2 className="text-2xl font-bold mb-3 text-green-700">
							Force Plate/Nordboard Analysis
						</h2>
						<p className="text-gray-600">
							Analyze force-plate and nordboard data.
						</p>
					</div>
					<a
						href="/data"
						className="mt-6 inline-block text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-xl transition"
					>
						Analyze Data
					</a>
				</div>
			</div>

			<footer className="text-center text-gray-500 mt-20 text-sm">
				<p>© 2025 ProTech - Aggie Sports Analytics</p>
			</footer>
		</div>
	);
}

export default Dashboard;
