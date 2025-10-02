import React from "react";

function Dashboard() {
  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}
      <div className="relative flex min-h-screen items-center">
        {/* Left side - Image with gradient */}
        <div className="absolute left-0 top-0 h-full w-3/5">
          <img 
            src="/blue.png" 
            alt="Football Player" 
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-white"></div>
        </div>

        {/* Right side - Content */}
        <div className="ml-auto w-1/2 pr-12">
          <div className="text-right">
            <h1 className="text-[8rem] font-black leading-none tracking-tighter text-[#0B1340]">
              PRO
              <br />
              <span className="text-[#B4975A]">TECH</span>
            </h1>
            <div className="mt-12 flex flex-col items-end gap-4">
              <a 
                href="/recruitment" 
                className="inline-flex w-64 items-center justify-center rounded-lg border-2 border-[#0B1340] bg-transparent px-6 py-3 text-lg font-medium text-[#0B1340] transition-colors hover:bg-[#0B1340] hover:text-white"
              >
                Athlete Profiles
              </a>
              <a 
                href="/data" 
                className="inline-flex w-64 items-center justify-center rounded-lg border-2 border-[#B4975A] bg-transparent px-6 py-3 text-lg font-medium text-[#B4975A] transition-colors hover:bg-[#B4975A] hover:text-white"
              >
                Data Visualization
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-4 right-8 pr-4">
          <p className="text-xs text-gray-400">
            Built by <a href="https://aggiesportsanalytics.com" target="_blank">Aggie Sports Analytics</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
