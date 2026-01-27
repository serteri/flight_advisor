"use client";

interface PriceHistoryChartProps {
    history: any[];
    currency: string;
}

export function PriceHistoryChart({ history, currency }: PriceHistoryChartProps) {
    if (!history || history.length < 2) {
        return (
            <div className="h-[200px] flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
                Collecting more data points for chart...
            </div>
        );
    }

    const prices = history.map(h => h.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1; // Avoid divide by zero

    // Dimensions
    const width = 800;
    const height = 200;
    const padding = 20;
    const chartHeight = height - padding * 2;
    const chartWidth = width;

    // Generate Points
    const points = prices.map((p, i) => {
        const x = (i / (prices.length - 1)) * chartWidth;
        const y = height - padding - ((p - minPrice) / range) * chartHeight;
        return `${x},${y}`;
    }).join(" ");

    // Area Path
    const areaPath = `${points} ${width},${height} 0,${height}`;

    return (
        <div className="w-full h-[200px] relative">
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Grid Lines (3 lines) */}
                {[0, 0.5, 1].map((pos) => (
                    <line
                        key={pos}
                        x1="0"
                        y1={height - padding - (pos * chartHeight)}
                        x2="100%"
                        y2={height - padding - (pos * chartHeight)}
                        stroke="#e2e8f0"
                        strokeWidth="1"
                        strokeDasharray="4"
                    />
                ))}

                {/* Area Fill */}
                <polygon points={areaPath} fill="url(#chartGradient)" />

                {/* Line */}
                <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

                {/* Data Points */}
                {prices.map((p, i) => {
                    const x = (i / (prices.length - 1)) * chartWidth;
                    const y = height - padding - ((p - minPrice) / range) * chartHeight;
                    return (
                        <circle key={i} cx={x} cy={y} r="4" fill="white" stroke="#2563eb" strokeWidth="2" />
                    );
                })}
            </svg>

            {/* Labels (Absolute) */}
            <div className="absolute top-0 right-0 text-[10px] bg-slate-100 px-1 rounded text-slate-500 font-medium">
                Max: {Math.round(maxPrice).toLocaleString()}
            </div>
            <div className="absolute bottom-0 right-0 text-[10px] bg-slate-100 px-1 rounded text-slate-500 font-medium">
                Min: {Math.round(minPrice).toLocaleString()}
            </div>
        </div>
    );
}
