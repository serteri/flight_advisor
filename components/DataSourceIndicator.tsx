"use client";

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Database, CheckCircle, XCircle, Loader2, Clock, Info } from 'lucide-react';
import { normalizeSource } from '@/lib/utils';
import type { ScoredFlight } from '@/types/unifiedFlight';

interface DataSourceStatus {
    name: string;
    status: 'loading' | 'active' | 'inactive' | 'error';
    count: number;
    color: string;
    lastUpdated?: Date;
    credibility?: number; // 0-100
}

export function DataSourceIndicator({ flights }: { flights: ScoredFlight[] }) {
    const t = useTranslations('Results');
    const [sources, setSources] = useState<DataSourceStatus[]>([]);

    useEffect(() => {
        const sourceCounts: Record<string, number> = {};
        
        flights.forEach(flight => {
            const source = normalizeSource(flight.source);
            sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        });

        const sourceList: DataSourceStatus[] = [
            {
                name: 'DUFFEL',
                status: sourceCounts['duffel'] > 0 ? 'active' : 'inactive',
                count: sourceCounts['duffel'] || 0,
                color: 'emerald'
            },
            {
                name: 'PRICELINE',
                status: (sourceCounts['priceline'] || sourceCounts['serpapi']) > 0 ? 'active' : 'inactive',
                count: (sourceCounts['priceline'] || 0) + (sourceCounts['serpapi'] || 0),
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
                    <h3 className="text-sm font-bold text-slate-900">{t('dataSources')}</h3>
                </div>
                <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <div className="text-xs font-medium text-slate-500">
                        {activeCount}/{sources.length} {t('active')}
                        <span className="text-slate-400 ml-1">• Updated moments ago</span>
                    </div>
                </div>
            </div>

            {/* Data Source Info Disclosure */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700">
                    <strong>Data Transparency:</strong> We search multiple flight providers in parallel. Results are live unless explicitly cached. 
                    <a href="/methodology#data-sources" className="underline hover:no-underline ml-1 font-semibold">Learn about our sources</a>
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
                                <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    <CheckCircle className={`w-4 h-4 text-${source.color}-600`} />
                                </div>
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
                            {source.status === 'active' ? t('flightsFoundLower') : t('noResultsLower')}
                        </div>

                        {/* Data freshness badge */}
                        {source.status === 'active' && (
                            <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-600">
                                <span className="inline-block bg-slate-100 px-1.5 py-0.5 rounded">
                                    ✓ Live data
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {totalFlights > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium text-slate-600">{t('totalResults')}</span>
                        <span className="font-black text-slate-900">{t('totalFlightsLabel', { count: totalFlights })}</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-2 overflow-hidden flex">
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

                    {/* Data mix explanation */}
                    <div className="mt-2 text-xs text-slate-500 space-y-1">
                        <div>
                            <strong>Source distribution:</strong> This mix helps us find the best prices across all providers.
                        </div>
                        <div>
                            <strong>Why different sources?</strong> Each provider has different availability. We compare all results using the same scoring criteria.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
