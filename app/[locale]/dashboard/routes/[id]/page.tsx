import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Clock, MapPin, Star } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { getCityFromAirportCode } from "@/lib/airport-utils";

export default async function RouteDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    const t = await getTranslations("RouteDetails");

    if (!session?.user?.email) redirect("/login");

    const route = await prisma.route.findUnique({
        where: { id: id },
        include: {
            user: true,
            priceSnapshots: {
                orderBy: { timestamp: 'desc' },
                take: 30
            }
        }
    });

    if (!route || route.user.email !== session.user.email) {
        notFound();
    }

    // Determine simple trend
    const current = route.currentPrice ?? 0;
    const mean = route.stats_mean ?? 0;
    const stdDev = route.stats_stdDev ?? 0;

    // Get latest snapshot for extra details (score, explanation)
    const latestSnapshot = route.priceSnapshots[0];

    // Calculate score from stored snapshot or from cached stats (like dashboard does)
    let score = latestSnapshot?.score ?? null;
    if (!score && current > 0 && mean > 0 && stdDev > 0) {
        // Calculate deal score from cached stats (same logic as dashboard)
        score = Math.max(0, Math.min(10, Math.round((5 + ((mean - current) / stdDev) * 2) * 10) / 10));
    }
    const finalScore = score ?? 0;

    const explanation = latestSnapshot?.explanation ?? t("calculating");
    const durationMinutes = latestSnapshot?.duration ?? 0;
    const stops = latestSnapshot?.stops ?? 0;

    const formatDuration = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${m}m`;
    };

    // Get city names from airport codes
    const originCity = getCityFromAirportCode(route.originCode);
    const destinationCity = getCityFromAirportCode(route.destinationCode);

    return (
        <div className="space-y-6">
            <Link href="/dashboard" className="text-slate-500 hover:text-slate-900 flex items-center gap-2 mb-4">
                <ArrowLeft size={16} /> {t("backToDashboard")}
            </Link>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                        {originCity} <span className="text-slate-400">→</span> {destinationCity}
                    </h1>
                    <p className="text-slate-500">
                        {new Date(route.startDate).toLocaleDateString()} - {new Date(route.endDate ?? route.startDate).toLocaleDateString()} • {route.cabin}
                    </p>
                </div>
                <div className="flex gap-2">
                    {current > 0 && (
                        <div className="text-right">
                            <div className="text-sm text-slate-500">{t("currentBestPrice")}</div>
                            <div className="text-3xl font-bold text-blue-600">{current.toLocaleString()} TRY</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="md:col-span-2 border-indigo-100 bg-indigo-50/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-indigo-900 flex items-center gap-2">
                            <Star size={16} className="text-indigo-600" /> {t("dealQuality")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-start">
                            <div>
                                <div className={`text-4xl font-bold ${finalScore >= 7 ? 'text-green-600' : finalScore >= 5 ? 'text-yellow-600' : 'text-slate-600'}`}>
                                    {finalScore}/10
                                </div>
                                <p className="text-sm text-slate-600 mt-2 font-medium">
                                    {finalScore >= 8 ? t("excellent") : finalScore >= 5 ? t("fair") : t("poor")}
                                </p>
                            </div>
                            <div className="text-sm text-slate-600 max-w-[200px] italic bg-white/50 p-2 rounded">
                                "{explanation}"
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                            <Clock size={16} /> {t("duration")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">
                            {durationMinutes > 0 ? formatDuration(durationMinutes) : t("noInfo")}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            {durationMinutes > 0 && (stops === 0 ? t("nonstop") : `${stops} ${stops === 1 ? t("stopResult") : t("stopsResult")}`)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">{t("average30d")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">
                            {mean > 0 ? mean.toLocaleString() : "-"} <span className="text-sm font-normal text-slate-400">TRY</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{t("historicalData")}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Price History List */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("recentHistory")}</CardTitle>
                </CardHeader>
                <CardContent>
                    {route.priceSnapshots.length === 0 ? (
                        <p className="text-slate-500 text-sm">{t("noData")}</p>
                    ) : (
                        <div className="space-y-2">
                            {route.priceSnapshots.map(price => (
                                <div key={price.id} className="flex justify-between items-center py-2 border-b last:border-0 border-slate-50">
                                    <div className="flex flex-col">
                                        <span className="text-slate-600 text-sm">{new Date(price.timestamp).toLocaleDateString()} {new Date(price.timestamp).toLocaleTimeString()}</span>
                                        <span className="text-xs text-slate-400">
                                            {price.provider}
                                            {price.duration && <> • {formatDuration(price.duration)}</>}
                                            {price.stops !== null && price.stops !== undefined && <> • {price.stops === 0 ? t("nonstop") : `${price.stops} ${price.stops === 1 ? t("stopResult") : t("stopsResult")}`}</>}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="font-medium">{price.amount.toLocaleString()} TRY</span>
                                        {price.score && (
                                            <span className={`text-xs font-bold ${price.score >= 7 ? 'text-green-600' : 'text-slate-400'}`}>Score: {price.score}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
