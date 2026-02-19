import { Link } from "@/i18n/routing";
import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingDown, ShieldCheck, Globe2, BrainCircuit, Zap, Search, Bell, Clock } from "lucide-react";
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
        </div>
    );
}
