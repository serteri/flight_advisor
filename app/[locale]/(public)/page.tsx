import { Link } from "@/i18n/routing";
import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingDown, Bell, Globe2, Wallet, Zap, Map } from "lucide-react";

export default function HomePage() {
    const t = useTranslations('HomePage');

    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-50">
                <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>

                <div className="container relative mx-auto px-4 md:px-6 text-center">
                    <div className="max-w-4xl mx-auto space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-medium animate-fade-in-up">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            v1.0 {t('hero.ctaSecondary')}
                        </div>

                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                            {t('hero.title')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{t('hero.titleHighlight')}</span>
                        </h1>

                        <p className="text-xl md:text-2xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
                            {t('hero.subtitle')}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                            <Link href="/flight-search">
                                <Button size="lg" className="h-14 px-8 text-lg rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/20 transition-all hover:scale-105">
                                    {t('hero.ctaPrimary')}
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                            <Link href="/about">
                                <Button variant="outline" size="lg" className="h-14 px-8 text-lg rounded-full border-slate-200 hover:bg-white hover:text-blue-600 text-slate-600 transition-all hover:scale-105">
                                    {t('hero.ctaSecondary')}
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section (Replaces Stats) */}
            <section className="py-20 bg-white border-y border-slate-100">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                        <h2 className="text-3xl font-bold text-slate-900">{t('howItWorks.title')}</h2>
                        <p className="text-xl text-slate-500">{t('howItWorks.subtitle')}</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12">
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl">1</div>
                            <h3 className="text-xl font-bold text-slate-900">{t('howItWorks.step1.title')}</h3>
                            <p className="text-slate-600">{t('howItWorks.step1.desc')}</p>
                        </div>
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl">2</div>
                            <h3 className="text-xl font-bold text-slate-900">{t('howItWorks.step2.title')}</h3>
                            <p className="text-slate-600">{t('howItWorks.step2.desc')}</p>
                        </div>
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl">3</div>
                            <h3 className="text-xl font-bold text-slate-900">{t('howItWorks.step3.title')}</h3>
                            <p className="text-slate-600">{t('howItWorks.step3.desc')}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 bg-slate-50 relative z-10">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
                        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">{t('features.title')}</h2>
                        <p className="text-xl text-slate-500">{t('features.subtitle')}</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 ">
                        {/* Feature 1 */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-blue-100 transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/5">
                            <div className="w-14 h-14 rounded-2xl bg-blue-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Bell className="w-7 h-7 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{t('features.smartAlerts.title')}</h3>
                            <p className="text-slate-500 leading-relaxed">
                                {t('features.smartAlerts.desc')}
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-indigo-100 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-900/5">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <TrendingDown className="w-7 h-7 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{t('features.priceHistory.title')}</h3>
                            <p className="text-slate-500 leading-relaxed">
                                {t('features.priceHistory.desc')}
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-teal-100 transition-all duration-300 hover:shadow-xl hover:shadow-teal-900/5">
                            <div className="w-14 h-14 rounded-2xl bg-teal-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Globe2 className="w-7 h-7 text-teal-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{t('features.globalSearch.title')}</h3>
                            <p className="text-slate-500 leading-relaxed">
                                {t('features.globalSearch.desc')}
                            </p>
                        </div>

                        {/* Feature 4 */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-purple-100 transition-all duration-300 hover:shadow-xl hover:shadow-purple-900/5">
                            <div className="w-14 h-14 rounded-2xl bg-purple-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Wallet className="w-7 h-7 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{t('features.noFees.title')}</h3>
                            <p className="text-slate-500 leading-relaxed">
                                {t('features.noFees.desc')}
                            </p>
                        </div>

                        {/* Feature 5 */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-amber-100 transition-all duration-300 hover:shadow-xl hover:shadow-amber-900/5">
                            <div className="w-14 h-14 rounded-2xl bg-amber-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Zap className="w-7 h-7 text-amber-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{t('features.instantNotify.title')}</h3>
                            <p className="text-slate-500 leading-relaxed">
                                {t('features.instantNotify.desc')}
                            </p>
                        </div>

                        {/* Feature 6 */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-200 hover:border-rose-100 transition-all duration-300 hover:shadow-xl hover:shadow-rose-900/5">
                            <div className="w-14 h-14 rounded-2xl bg-rose-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Map className="w-7 h-7 text-rose-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{t('features.trends.title')}</h3>
                            <p className="text-slate-500 leading-relaxed">
                                {t('features.trends.desc')}
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
