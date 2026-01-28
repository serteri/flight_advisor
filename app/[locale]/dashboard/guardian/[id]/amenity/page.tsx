import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AmenityClaimForm } from "@/components/guardian/AmenityClaimForm";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";

export default async function AmenityPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Fetch MonitoredTrip
    const trip = await prisma.monitoredTrip.findUnique({
        where: { id }
    });

    if (!trip) {
        notFound();
    }

    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <Link href={`/dashboard/guardian/${id}`} className="inline-flex items-center text-slate-500 hover:text-slate-900 mb-8 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Trip Dashboard
            </Link>

            <AmenityClaimForm
                airline={trip.airlineCode}
                pnr={trip.pnr}
            />
        </div>
    );
}

// Generate static params if creating static build, unnecessary for dynamic
export async function generateStaticParams() {
    return [];
}
