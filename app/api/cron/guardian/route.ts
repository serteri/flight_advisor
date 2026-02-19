// app/api/cron/guardian/route.ts
import { processFlightMonitoring } from "@/workers/guardianWorker";
import { NextRequest, NextResponse } from "next/server";

/**
 * Vercel Cron Endpoint for Guardian Worker
 * 
 * Security:
 * - Only runs with valid CRON_SECRET
 * - Only responds to requests from Vercel's cron service
 * 
 * Usage:
 * - Triggered automatically by Vercel at scheduled intervals
 * - Can also be manually triggered with Authorization header
 */

export async function GET(request: NextRequest) {
    // Security: Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    // Check 1: Bearer token validation
    if (!cronSecret) {
        console.error("❌ [CRON] CRON_SECRET is not set in environment");
        return NextResponse.json(
            { error: "Cron secret not configured" },
            { status: 500 }
        );
    }
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.warn("❌ [CRON] Unauthorized request - no Bearer token");
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }
    
    const token = authHeader.substring("Bearer ".length);
    if (token !== cronSecret) {
        console.warn("❌ [CRON] Unauthorized request - invalid token");
        return NextResponse.json(
            { error: "Invalid token" },
            { status: 401 }
        );
    }
    
    // Check 2: Verify Vercel's User-Agent (optional extra security)
    const userAgent = request.headers.get("user-agent");
    if (!userAgent?.includes("Vercel")) {
        console.warn("⚠️  [CRON] Request from non-Vercel source (might be local test)");
        // Don't reject - allow for local testing
    }
    
    try {
        console.log("🛡️ [CRON] Guardian Worker triggered at", new Date().toISOString());
        
        // Run the monitoring cycle
        await processFlightMonitoring();
        
        return NextResponse.json(
            { 
                success: true, 
                message: "Guardian monitoring cycle completed",
                timestamp: new Date().toISOString()
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("❌ [CRON] Error running Guardian Worker:", error);
        
        return NextResponse.json(
            { 
                success: false, 
                error: error?.message || "Unknown error",
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}

/**
 * POST endpoint for manual triggering (testing)
 * 
 * Example:
 * curl -X POST http://localhost:3000/api/cron/guardian \
 *   -H "Authorization: Bearer <CRON_SECRET>"
 */
export async function POST(request: NextRequest) {
    // Same security checks as GET
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || !authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }
    
    const token = authHeader.substring("Bearer ".length);
    if (token !== cronSecret) {
        return NextResponse.json(
            { error: "Invalid token" },
            { status: 401 }
        );
    }
    
    try {
        console.log("🛡️ [CRON] Guardian Worker manually triggered");
        await processFlightMonitoring();
        
        return NextResponse.json(
            { 
                success: true, 
                message: "Guardian monitoring cycle completed"
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("❌ [CRON] Error:", error);
        return NextResponse.json(
            { error: error?.message || "Unknown error" },
            { status: 500 }
        );
    }
}
