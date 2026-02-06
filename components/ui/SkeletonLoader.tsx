"use client";

export default function SkeletonLoader() {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 animate-pulse">
            {/* Top Banner */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                <div className="flex gap-2">
                    <div className="h-6 w-24 bg-slate-200 rounded-md"></div>
                    <div className="h-6 w-20 bg-slate-200 rounded-md"></div>
                </div>
                <div className="h-8 w-12 bg-slate-200 rounded-lg"></div>
            </div>

            {/* Main Content */}
            <div className="flex flex-col md:flex-row gap-6">
                {/* Left: Flight Info */}
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                        <div className="space-y-2">
                            <div className="h-4 w-32 bg-slate-200 rounded"></div>
                            <div className="h-3 w-20 bg-slate-200 rounded"></div>
                        </div>
                    </div>

                    {/* Route */}
                    <div className="flex items-center gap-4">
                        <div className="w-16">
                            <div className="h-5 w-12 bg-slate-200 rounded mb-1"></div>
                            <div className="h-3 w-10 bg-slate-200 rounded"></div>
                        </div>
                        <div className="flex-1 h-0.5 bg-slate-200"></div>
                        <div className="w-16">
                            <div className="h-5 w-12 bg-slate-200 rounded mb-1"></div>
                            <div className="h-3 w-10 bg-slate-200 rounded"></div>
                        </div>
                    </div>
                </div>

                {/* Right: Price */}
                <div className="flex flex-col items-end gap-3">
                    <div className="h-8 w-24 bg-slate-200 rounded"></div>
                    <div className="flex gap-2">
                        <div className="h-6 w-16 bg-slate-200 rounded"></div>
                        <div className="h-6 w-16 bg-slate-200 rounded"></div>
                    </div>
                    <div className="h-10 w-32 bg-slate-200 rounded-lg"></div>
                </div>
            </div>

            {/* Bottom Section */}
            <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="h-16 bg-slate-200 rounded-lg"></div>
            </div>
        </div>
    );
}
