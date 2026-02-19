import { Link } from "@/i18n/routing";
import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingDown, ShieldCheck, Globe2, BrainCircuit, Zap, Search, Bell, Clock } from "lucide-react";
import { SearchForm } from "@/components/search/SearchForm";
import { PricingTable } from "@/components/marketing/PricingTable";

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
                    <div className="max-w-4xl mx-auto p-2 md:p-6 relative z-50 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg z-50">
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
            <section id="features" className="py-24 bg-gradient-to-b from-white to-slate-50 relative z-10">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
                        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">The Flight Guardian Advantage</h2>
                        <p className="text-xl text-slate-500">Complete protection for your travel with AI-powered monitoring</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1: Hybrid Search Engine */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-blue-200 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-900/10">
                            <div className="w-14 h-14 rounded-2xl bg-blue-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Globe2 className="w-7 h-7 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Hybrid Search Engine (4 Sources)</h3>
                            <p className="text-slate-600 leading-relaxed text-sm">
                                Compare prices across <strong>RapidAPI Scrapers</strong>, <strong>Amadeus GDS</strong>, <strong>Travelpayouts</strong>, and <strong>Duffel</strong>. Find flights others miss with institutional-grade accuracy.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">400+ Airlines</span>
                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">Real-time</span>
                            </div>
                        </div>

                        {/* Feature 2: Master Flight Score */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-indigo-200 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-900/10">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <BrainCircuit className="w-7 h-7 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Master Flight Score (0-100)</h3>
                            <p className="text-slate-600 leading-relaxed text-sm">
                                12-factor AI scoring: <strong>Price</strong> (24%), <strong>Duration</strong> (20%), <strong>Airline</strong> (15%), <strong>Aircraft</strong> (10%), and more. Not just cheap—smart.
                            </p>
                            <div className="mt-4">
                                <div className="text-xs text-slate-500">Score Breakdown:</div>
                                <div className="text-xs text-slate-600 mt-1 space-y-1">
                                    <div>• CORE: 60% (price, duration, stops)</div>
                                    <div>• QUALITY: 25% (airline, baggage, meals)</div>
                                    <div>• SMART: 15% (stability, reliability)</div>
                                </div>
                            </div>
                        </div>

                        {/* Feature 3: Disruption Hunter + Compensation */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-emerald-200 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-900/10">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <ShieldCheck className="w-7 h-7 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Disruption Hunter + EU261</h3>
                            <p className="text-slate-600 leading-relaxed text-sm">
                                24/7 automated monitoring detects delays &gt;180 mins. We identify your compensation rights (up to <strong>€600</strong>) and guide you through the claim process automatically.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded">CRITICAL alerts</span>
                                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded">Auto-monitoring</span>
                            </div>
                        </div>

                        {/* Feature 4: Smart Notifications */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-rose-200 transition-all duration-300 hover:shadow-2xl hover:shadow-rose-900/10">
                            <div className="w-14 h-14 rounded-2xl bg-rose-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Bell className="w-7 h-7 text-rose-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Smart Notifications (Multi-Channel)</h3>
                            <p className="text-slate-600 leading-relaxed text-sm">
                                Receive alerts via <strong>Email</strong> (Resend), <strong>SMS</strong> (Twilio), or <strong>Push</strong> notifications. Personalize by tier: Standard mode or Junior Guardian (friendly AI voice).
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="text-xs bg-rose-50 text-rose-700 px-2 py-1 rounded">Email</span>
                                <span className="text-xs bg-rose-50 text-rose-700 px-2 py-1 rounded">SMS</span>
                                <span className="text-xs bg-rose-50 text-rose-700 px-2 py-1 rounded">Push</span>
                            </div>
                        </div>

                        {/* Feature 5: Guardian Worker (24/7) */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-amber-200 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-900/10">
                            <div className="w-14 h-14 rounded-2xl bg-amber-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Clock className="w-7 h-7 text-amber-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Guardian Worker (24/7 Monitoring)</h3>
                            <p className="text-slate-600 leading-relaxed text-sm">
                                Every 15 minutes, our Vercel Cron worker checks every tracked flight for status changes. Delays, cancellations, gate changes—you're alerted instantly.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded">Every 15 min</span>
                                <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded">Never sleeps</span>
                            </div>
                        </div>

                        {/* Feature 6: Multi-Language + Inbox Parser */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-purple-200 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-900/10">
                            <div className="w-14 h-14 rounded-2xl bg-purple-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Zap className="w-7 h-7 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Smart Inbox Parser + Schedule Guardian</h3>
                            <p className="text-slate-600 leading-relaxed text-sm">
                                Forward your booking emails. We extract PNR codes, connect to airlines, and auto-track your trips. Available in <strong>12 languages</strong> for global travelers.
                            </p>
                            <div className="mt-4">
                                <div className="text-xs text-slate-500">Supported: EN, TR, DE, + 9 more</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <PricingTable />
        </div>
    );
}
