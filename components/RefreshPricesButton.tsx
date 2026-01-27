"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function RefreshPricesButton() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const router = useRouter();

    const handleRefresh = async () => {
        setLoading(true);
        setStatus("idle");

        try {
            const res = await fetch("/api/cron/update-prices");
            if (!res.ok) throw new Error("Update failed");

            setStatus("success");
            router.refresh();

            // Reset success status after 2 seconds
            setTimeout(() => setStatus("idle"), 2000);
        } catch (error) {
            console.error("Manual update failed:", error);
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleRefresh}
            disabled={loading}
            className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                status === "success"
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : status === "error"
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-blue-600"
            )}
        >
            {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
            ) : status === "success" ? (
                <Check className="h-4 w-4" />
            ) : status === "error" ? (
                <AlertCircle className="h-4 w-4" />
            ) : (
                <RefreshCw className="h-4 w-4" />
            )}

            {loading ? "Updating..." :
                status === "success" ? "Updated!" :
                    status === "error" ? "Failed" :
                        "Update Prices"}
        </button>
    );
}
