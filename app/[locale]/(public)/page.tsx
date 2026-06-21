import { ShieldCheck, Bell, Clock, FileText, ArrowRight, PlaneTakeoff, AlertTriangle } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { HeroSearchForm } from "@/components/home/HeroSearchForm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "FlightAgent — Flight Monitoring & EU261 Compensation",
    description: "Monitor your flights, get disruption alerts, and generate EU261 compensation claims automatically.",
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations("HomePage.guardian");

    return (
        <div className="flex flex-col min-h-screen">
            <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-sky-50">
                <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                    <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
                    <div className="absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
                </div>
                <div className="container relative mx-auto px-4 md:px-6">
                    <div className="max-w-4xl mx-auto text-center space-y-8 mb-14">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
                            <ShieldCheck className="w-4 h-4" />
                            {t("badge")}
                        </div>

                        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                            {t("hero.title")}
                            <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-sky-600">
                                {t("hero.titleHighlight")}
                            </span>
                        </h1>

                        <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                            {t("hero.subtitle")}
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <Link href="/dashboard/guardian">
                                <Button className="rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-semibold">
                                    {t("cta.openGuardian")} <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>
                            </Link>
                            <Link href="/pricing">
                                <Button variant="outline" className="rounded-xl border-slate-300 text-slate-800">
                                    {t("cta.seePlans")}
                                </Button>
                            </Link>
                        </div>
                    </div>

                    <div className="mb-14">
                        <HeroSearchForm />
                    </div>

                    <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-3">
                        <div className="bg-white rounded-2xl p-7 border border-slate-200 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                                <PlaneTakeoff className="w-6 h-6 text-emerald-600" />
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">{t("features.monitoring.title")}</h3>
                            <p className="text-sm text-slate-600">{t("features.monitoring.desc")}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-7 border border-slate-200 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
                                <Bell className="w-6 h-6 text-amber-600" />
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">{t("features.alerts.title")}</h3>
                            <p className="text-sm text-slate-600">{t("features.alerts.desc")}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-7 border border-slate-200 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center mb-4">
                                <FileText className="w-6 h-6 text-sky-600" />
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">{t("features.compensation.title")}</h3>
                            <p className="text-sm text-slate-600">{t("features.compensation.desc")}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-20 bg-slate-900 text-white border-t border-slate-800">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6">
                            <Clock className="w-5 h-5 text-emerald-300 mb-3" />
                            <h3 className="font-semibold mb-1">{t("trust.transparency.title")}</h3>
                            <p className="text-sm text-slate-300">{t("trust.transparency.desc")}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6">
                            <AlertTriangle className="w-5 h-5 text-amber-300 mb-3" />
                            <h3 className="font-semibold mb-1">{t("trust.warnings.title")}</h3>
                            <p className="text-sm text-slate-300">{t("trust.warnings.desc")}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6">
                            <ShieldCheck className="w-5 h-5 text-sky-300 mb-3" />
                            <h3 className="font-semibold mb-1">{t("trust.protection.title")}</h3>
                            <p className="text-sm text-slate-300">{t("trust.protection.desc")}</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
