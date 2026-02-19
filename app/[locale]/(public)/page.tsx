import { useTranslations } from 'next-intl';
import { TrendingDown, ShieldCheck, Globe2, BrainCircuit, Zap, Search, Bell, Clock } from "lucide-react";
import { SearchForm } from "@/components/search/SearchForm";

export default function HomePage() {
    const t = useTranslations('HomePage');

    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero Section with Search Bar */}
            <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 bg-white">
                <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-50"></div>

                <div className="container relative mx-auto px-4 md:px-6">
                    <div className="max-w-5xl mx-auto text-center space-y-8 mb-12">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold animate-fade-in-up">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            {t('badge.engineActive')}
                        </div>

                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                            {t('hero.title')} <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                                {t('hero.titleHighlight')}
                            </span>
                        </h1>

                        <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
                            {t('hero.subtitle')}
                        </p>
                    </div>

                    {/* Integrated Search Bar */}
                    <div className="max-w-4xl mx-auto p-2 md:p-6 relative z-50 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg z-50">
                            {t('badge.aiMode')}
                        </div>
                        <SearchForm />
                    </div>

                    {/* Quick Trust Indicators */}
                    <div className="mt-12 flex flex-wrap justify-center gap-6 md:gap-12 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                        {/* Placeholder logos or trust text */}
                        <span className="flex items-center gap-2 font-semibold text-slate-400"><Globe2 className="w-5 h-5" /> {t('trust.airlines')}</span>
                        <span className="flex items-center gap-2 font-semibold text-slate-400"><ShieldCheck className="w-5 h-5" /> {t('trust.secure')}</span>
                        <span className="flex items-center gap-2 font-semibold text-slate-400"><Zap className="w-5 h-5" /> {t('trust.realtime')}</span>
                    </div>
                </div>
            </section>

            {/* System Overview */}
            <section className="py-24 bg-slate-50 border-t border-slate-200">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="max-w-4xl mx-auto text-center space-y-4 mb-12">
                        <div className="text-xs uppercase tracking-[0.3em] font-semibold text-slate-500">{t('system.label')}</div>
                        <h2 className="text-3xl md:text-5xl font-bold text-slate-900">{t('system.title')}</h2>
                        <p className="text-slate-600 text-lg">
                            {t('system.subtitle')}
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                                <Search className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">{t('system.cards.hybrid.title')}</h3>
                            <p className="text-slate-600 text-sm">{t('system.cards.hybrid.desc')}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
                                <BrainCircuit className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">{t('system.cards.scoring.title')}</h3>
                            <p className="text-slate-600 text-sm">{t('system.cards.scoring.desc')}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">{t('system.cards.disruption.title')}</h3>
                            <p className="text-slate-600 text-sm">{t('system.cards.disruption.desc')}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
                                <Clock className="w-6 h-6 text-amber-600" />
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">{t('system.cards.guardian.title')}</h3>
                            <p className="text-slate-600 text-sm">{t('system.cards.guardian.desc')}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center mb-4">
                                <Bell className="w-6 h-6 text-rose-600" />
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">{t('system.cards.notifications.title')}</h3>
                            <p className="text-slate-600 text-sm">{t('system.cards.notifications.desc')}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mb-4">
                                <Zap className="w-6 h-6 text-purple-600" />
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">{t('system.cards.inbox.title')}</h3>
                            <p className="text-slate-600 text-sm">{t('system.cards.inbox.desc')}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Master Flight Scoring Engine */}
            <section className="py-24 bg-white border-t border-slate-200">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="max-w-4xl mx-auto text-center space-y-4 mb-12">
                        <div className="text-xs uppercase tracking-[0.3em] font-semibold text-slate-500">{t('scoring.label')}</div>
                        <h2 className="text-3xl md:text-5xl font-bold text-slate-900">{t('scoring.title')}</h2>
                        <p className="text-slate-600 text-lg">
                            {t('scoring.subtitle')}
                        </p>
                    </div>

                    <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50">
                            <div className="flex items-center gap-3 mb-4">
                                <TrendingDown className="w-5 h-5 text-slate-700" />
                                <h3 className="font-bold text-slate-900">{t('scoring.formula.title')}</h3>
                            </div>
                            <p className="text-sm text-slate-600 mb-4">{t('scoring.formula.intro')}</p>
                            <div className="space-y-3 text-sm text-slate-700">
                                <div><span className="font-bold">{t('scoring.formula.items.price.title')}</span> {t('scoring.formula.items.price.desc')}</div>
                                <div><span className="font-bold">{t('scoring.formula.items.duration.title')}</span> {t('scoring.formula.items.duration.desc')}</div>
                                <div><span className="font-bold">{t('scoring.formula.items.stops.title')}</span> {t('scoring.formula.items.stops.desc')}</div>
                                <div><span className="font-bold">{t('scoring.formula.items.connection.title')}</span> {t('scoring.formula.items.connection.desc')}</div>
                                <div><span className="font-bold">{t('scoring.formula.items.selfTransfer.title')}</span> {t('scoring.formula.items.selfTransfer.desc')}</div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50">
                            <div className="flex items-center gap-3 mb-4">
                                <BrainCircuit className="w-5 h-5 text-slate-700" />
                                <h3 className="font-bold text-slate-900">{t('scoring.quality.title')}</h3>
                            </div>
                            <div className="space-y-3 text-sm text-slate-700">
                                <div><span className="font-bold">{t('scoring.quality.items.baggage.title')}</span> {t('scoring.quality.items.baggage.desc')}</div>
                                <div><span className="font-bold">{t('scoring.quality.items.reliability.title')}</span> {t('scoring.quality.items.reliability.desc')}</div>
                                <div><span className="font-bold">{t('scoring.quality.items.aircraft.title')}</span> {t('scoring.quality.items.aircraft.desc')}</div>
                                <div><span className="font-bold">{t('scoring.quality.items.amenity.title')}</span> {t('scoring.quality.items.amenity.desc')}</div>
                                <div><span className="font-bold">{t('scoring.quality.items.airport.title')}</span> {t('scoring.quality.items.airport.desc')}</div>
                            </div>
                        </div>
                    </div>

                    <div className="max-w-5xl mx-auto mt-8 grid gap-6 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 p-5 bg-white">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{t('scoring.final.score.title')}</div>
                            <div className="text-sm text-slate-700">{t('scoring.final.score.desc')}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-5 bg-white">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{t('scoring.final.risk.title')}</div>
                            <div className="text-sm text-slate-700">{t('scoring.final.risk.desc')}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-5 bg-white">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{t('scoring.final.value.title')}</div>
                            <div className="text-sm text-slate-700">{t('scoring.final.value.desc')}</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Strategic Difference */}
            <section className="py-24 bg-slate-900 text-white">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="max-w-4xl mx-auto text-center space-y-4 mb-12">
                        <div className="text-xs uppercase tracking-[0.3em] font-semibold text-slate-300">{t('strategic.label')}</div>
                        <h2 className="text-3xl md:text-5xl font-bold">{t('strategic.title')}</h2>
                        <p className="text-slate-300 text-lg">{t('strategic.subtitle')}</p>
                    </div>

                    <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{t('strategic.typical.title')}</div>
                            <ul className="space-y-2 text-sm text-slate-200">
                                <li>{t('strategic.typical.items.price')}</li>
                                <li>{t('strategic.typical.items.risk')}</li>
                                <li>{t('strategic.typical.items.future')}</li>
                                <li>{t('strategic.typical.items.crisis')}</li>
                            </ul>
                        </div>
                        <div className="rounded-2xl border border-emerald-700/40 bg-emerald-900/20 p-6">
                            <div className="text-xs font-bold uppercase tracking-wider text-emerald-200 mb-3">{t('strategic.agent.title')}</div>
                            <ul className="space-y-2 text-sm text-emerald-100">
                                <li>{t('strategic.agent.items.ranking')}</li>
                                <li>{t('strategic.agent.items.scenario')}</li>
                                <li>{t('strategic.agent.items.protection')}</li>
                                <li>{t('strategic.agent.items.compensation')}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
