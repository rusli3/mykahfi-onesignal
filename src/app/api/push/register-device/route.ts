import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { setExternalId } from "@/lib/onesignal";

export async function POST(request: Request) {
    try {
        const session = await getSession();
        const sessionNis = session.nis;

        if (!sessionNis) {
            return NextResponse.json(
                { ok: false, error: "Sesi tidak valid." },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { nis, onesignal_subscription_id, platform, external_id } = body;

        // Validate
        if (!nis || !onesignal_subscription_id || !platform) {
            return NextResponse.json(
                { ok: false, error: "Data tidak lengkap." },
                { status: 400 }
            );
        }

        if (nis !== sessionNis) {
            return NextResponse.json(
                { ok: false, error: "NIS tidak sesuai sesi." },
                { status: 403 }
            );
        }

        const validPlatforms = ["ios_web", "android_web", "desktop_web"];
        if (!validPlatforms.includes(platform)) {
            return NextResponse.json(
                { ok: false, error: "Platform tidak valid." },
                { status: 400 }
            );
        }

        // Upsert device to user_devices_web
        const { error: upsertError } = await supabase
            .from("user_devices_web")
            .upsert(
                {
                    nis,
                    onesignal_subscription_id,
                    external_id: external_id || nis,
                    platform,
                    is_active: true,
                    last_seen_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: "onesignal_subscription_id,platform",
                }
            );

        if (upsertError) {
            console.error("Device upsert error:", upsertError);
            return NextResponse.json(
                { ok: false, error: "Gagal mendaftarkan perangkat." },
                { status: 503 }
            );
        }

        // Set external_id on OneSignal
        await setExternalId(onesignal_subscription_id, external_id || nis);

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Push register error:", err);
        return NextResponse.json(
            { ok: false, error: "Terjadi gangguan. Silakan coba lagi." },
            { status: 503 }
        );
    }
}
