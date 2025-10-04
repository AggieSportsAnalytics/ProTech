function Loader() {
	return (
		<div className="fixed inset-0 flex items-center justify-center bg-white z-50">
			<img 
				src="/logo.png" 
				alt="Loading..." 
				className="h-24 w-auto animate-fast-pulse"
			/>
		</div>
	);
}

export default Loader;
