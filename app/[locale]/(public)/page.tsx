import { Link } from "@/i18n/routing";
import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingDown, ShieldCheck, Globe2, BrainCircuit, Zap, Search } from "lucide-react";
import { SearchForm } from "@/components/search/SearchForm";

export default function HomePage() {
    const t = useTranslations('HomePage');

    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero Section with Search Bar */}
            <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden bg-white">
                <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-50"></div>

                <div className="container relative mx-auto px-4 md:px-6">
                    <div className="max-w-5xl mx-auto text-center space-y-8 mb-12">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold animate-fade-in-up">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            v1.2 Hybrid Engine Active
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
                    <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl shadow-blue-900/10 border border-slate-200/60 p-2 md:p-6 relative z-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                            🚀 Flight Agent: AI Mode
                        </div>
                        <SearchForm />
                    </div>

                    {/* Quick Trust Indicators */}
                    <div className="mt-12 flex flex-wrap justify-center gap-6 md:gap-12 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                        {/* Placeholder logos or trust text */}
                        <span className="flex items-center gap-2 font-semibold text-slate-400"><Globe2 className="w-5 h-5" /> 400+ Airlines</span>
                        <span className="flex items-center gap-2 font-semibold text-slate-400"><ShieldCheck className="w-5 h-5" /> Secure Booking</span>
                        <span className="flex items-center gap-2 font-semibold text-slate-400"><Zap className="w-5 h-5" /> Real-time Status</span>
                    </div>
                </div>
            </section>

            {/* Features Section - "The Agent Advantage" */}
            <section id="features" className="py-24 bg-slate-50 relative z-10">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
                        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">The Flight Agent Advantage</h2>
                        <p className="text-xl text-slate-500">Why travelers switch to our Hybrid Engine</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1: Hybrid Engine */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-blue-100 transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/5">
                            <div className="w-14 h-14 rounded-2xl bg-blue-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Globe2 className="w-7 h-7 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Hybrid Search Engine</h3>
                            <p className="text-slate-500 leading-relaxed">
                                We combine <strong>RapidAPI Scrapers</strong> with <strong>Amadeus GDS</strong> precision. Get the low-cost fares others miss, with the reliability of a global system.
                            </p>
                        </div>

                        {/* Feature 2: Agent Score */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-indigo-100 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-900/5">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <BrainCircuit className="w-7 h-7 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Agent Score IQ</h3>
                            <p className="text-slate-500 leading-relaxed">
                                Not just price. We calculate value using our custom formula: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">Price vs Comfort vs Hidden Fees</code>.
                            </p>
                        </div>

                        {/* Feature 3: Disruption Hunter */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-teal-100 transition-all duration-300 hover:shadow-xl hover:shadow-teal-900/5">
                            <div className="w-14 h-14 rounded-2xl bg-teal-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <ShieldCheck className="w-7 h-7 text-teal-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Disruption Hunter</h3>
                            <p className="text-slate-500 leading-relaxed">
                                Automatic monitoring for delays over 180 mins. We flag compensatable flights so you can claim up to <strong>€600</strong> properly.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
