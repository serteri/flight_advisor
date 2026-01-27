
import { PrismaClient } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { ShieldCheck, AlertTriangle, Plane, PlusCircle } from "lucide-react";
import { TravelGuardianDashboard } from "@/components/TravelGuardianDashboard"; // New component

// Initialize Prisma
const prisma = new PrismaClient();

// Mock User ID (In real app, use auth() session)
const MOCK_USER_ID = "user_clv4123";

export default async function GuardianDashboard() {
    const t = await getTranslations("Guardian");

    // Fetch Monitored Trips (V2 Model)
    const trips = await prisma.monitoredTrip.findMany({
        // where: { userId: MOCK_USER_ID }, // Enable when auth is ready
        orderBy: { createdAt: 'desc' },
        include: { alerts: true }
    });

    const activeTrips = trips.filter(t => t.status === 'ACTIVE');
    const alertsTotal = trips.reduce((acc, t) => acc + t.alerts.length, 0);
    // Calculate potential value from alerts (parsing string value like "600 EUR" is hard, simplified count)

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-emerald-600" />
                        Travel Guardian
                    </h1>
                    <p className="text-slate-500 mt-1">SaaS Protection Engine Active.</p>
                </div>
                <div className="flex gap-4">
                    <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors">
                        <PlusCircle size={18} /> Add Trip
                    </button>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Protected Trips</p>
                    <p className="text-2xl font-bold text-slate-800">{activeTrips.length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Active Alerts</p>
                    <p className="text-2xl font-bold text-amber-600">{alertsTotal}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Scanning Frequency</p>
                    <p className="text-2xl font-bold text-blue-600">Every 60m</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Est. Value Found</p>
                    <p className="text-2xl font-bold text-emerald-600">--</p>
                </div>
            </div>

            {/* ACTIVE TRIPS */}
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-800">Your Protected Journeys</h2>

                {trips.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <Plane className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                        <h3 className="text-lg font-medium text-slate-900">No active trips</h3>
                        <p className="text-slate-500">Import a PNR to start monitoring.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {trips.map(trip => (
                            <div key={trip.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
                                {/* Pass trip data to the Dashboard Component we created earlier */}
                                {/* Need to adapt type if necessary, but structure matches closely */}
                                <TravelGuardianDashboard trip={trip as any} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
