import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

function mask(value?: string): string | null {
    if (!value) return null;
    if (value.length <= 8) return "****";
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function GET() {
    try {
        const session = await getSession();
        if (!session.nis) {
            return NextResponse.json(
                { ok: false, error: "Sesi tidak valid." },
                { status: 401 }
            );
        }

        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

        return NextResponse.json({
            ok: true,
            onesignal: {
                app_id_configured: !!appId,
                rest_api_key_configured: !!restApiKey,
                app_id_masked: mask(appId),
                rest_api_key_masked: mask(restApiKey),
            },
        });
    } catch (err) {
        console.error("Push debug-config error:", err);
        return NextResponse.json(
            { ok: false, error: "Terjadi gangguan. Silakan coba lagi." },
            { status: 503 }
        );
    }
}
