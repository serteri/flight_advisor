"use client";

import { useState, useEffect } from 'react';
import { Database, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

interface DataSourceStatus {
    name: string;
    status: 'loading' | 'active' | 'inactive' | 'error';
    count: number;
    color: string;
}

export function DataSourceIndicator({ flights }: { flights: any[] }) {
    const [sources, setSources] = useState<DataSourceStatus[]>([]);

    useEffect(() => {
        const sourceCounts: Record<string, number> = {};
        
        flights.forEach(flight => {
            const source = flight.source || 'UNKNOWN';
            sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        });

        const sourceList: DataSourceStatus[] = [
            {
                name: 'DUFFEL',
                status: sourceCounts['DUFFEL'] > 0 ? 'active' : 'inactive',
                count: sourceCounts['DUFFEL'] || 0,
                color: 'emerald'
            },
            {
                name: 'PRICELINE',
                status: (sourceCounts['PRICELINE'] || sourceCounts['SERPAPI']) > 0 ? 'active' : 'inactive',
                count: (sourceCounts['PRICELINE'] || 0) + (sourceCounts['SERPAPI'] || 0),
                color: 'violet'
            }
        ];

        setSources(sourceList);
    }, [flights]);

    if (sources.length === 0) return null;

    const activeCount = sources.filter(s => s.status === 'active').length;
    const totalFlights = sources.reduce((sum, s) => sum + s.count, 0);

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-slate-600" />
                    <h3 className="text-sm font-bold text-slate-900">Veri Kaynakları</h3>
                </div>
                <div className="text-xs font-medium text-slate-500">
                    {activeCount}/{sources.length} Aktif
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {sources.map((source) => (
                    <div
                        key={source.name}
                        className={`relative rounded-lg p-3 border-2 transition-all ${
                            source.status === 'active'
                                ? `border-${source.color}-200 bg-${source.color}-50`
                                : 'border-slate-100 bg-slate-50 opacity-60'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-bold uppercase tracking-wide ${
                                source.status === 'active' 
                                    ? `text-${source.color}-700` 
                                    : 'text-slate-400'
                            }`}>
                                {source.name}
                            </span>
                            {source.status === 'active' ? (
                                <CheckCircle className={`w-4 h-4 text-${source.color}-600`} />
                            ) : source.status === 'loading' ? (
                                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                            ) : (
                                <XCircle className="w-4 h-4 text-slate-300" />
                            )}
                        </div>
                        <div className="text-xl font-black text-slate-900">
                            {source.count}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                            {source.status === 'active' ? 'uçuş bulundu' : 'sonuç yok'}
                        </div>
                    </div>
                ))}
            </div>

            {totalFlights > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-600">Toplam Sonuç</span>
                        <span className="font-black text-slate-900">{totalFlights} Uçuş</span>
                    </div>
                    <div className="mt-2 bg-slate-100 rounded-full h-2 overflow-hidden flex">
                        {sources.map((source) => {
                            if (source.count === 0) return null;
                            const percentage = (source.count / totalFlights) * 100;
                            return (
                                <div
                                    key={source.name}
                                    className={`bg-${source.color}-500 h-full`}
                                    style={{ width: `${percentage}%` }}
                                    title={`${source.name}: ${source.count} (${percentage.toFixed(0)}%)`}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
