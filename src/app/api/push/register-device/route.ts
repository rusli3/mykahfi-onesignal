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

        const nowIso = new Date().toISOString();

        // Tolerant sync strategy:
        // 1) find by subscription+platform
        // 2) update if exists, else insert
        const { data: existing, error: lookupError } = await supabase
            .from("user_devices_web")
            .select("id")
            .eq("onesignal_subscription_id", onesignal_subscription_id)
            .eq("platform", platform)
            .limit(1)
            .maybeSingle();

        if (lookupError) {
            console.error("Device lookup error:", lookupError);
            return NextResponse.json(
                { ok: false, error: "Gagal memeriksa perangkat.", detail: lookupError.message },
                { status: 503 }
            );
        }

        if (existing?.id) {
            const { error: updateError } = await supabase
                .from("user_devices_web")
                .update({
                    nis,
                    external_id: external_id || nis,
                    is_active: true,
                    last_seen_at: nowIso,
                    updated_at: nowIso,
                })
                .eq("id", existing.id);

            if (updateError) {
                console.error("Device update error:", updateError);
                return NextResponse.json(
                    { ok: false, error: "Gagal memperbarui perangkat.", detail: updateError.message },
                    { status: 503 }
                );
            }
        } else {
            const { error: insertError } = await supabase
                .from("user_devices_web")
                .insert({
                    nis,
                    onesignal_subscription_id,
                    external_id: external_id || nis,
                    platform,
                    is_active: true,
                    last_seen_at: nowIso,
                    updated_at: nowIso,
                });

            if (insertError) {
                console.error("Device insert error:", insertError);
                return NextResponse.json(
                    { ok: false, error: "Gagal mendaftarkan perangkat.", detail: insertError.message },
                    { status: 503 }
                );
            }
        }

        // Set external_id on OneSignal
        const externalIdSynced = await setExternalId(
            onesignal_subscription_id,
            external_id || nis
        );
        if (!externalIdSynced) {
            console.error("Failed to sync external_id to OneSignal", {
                nis,
                onesignal_subscription_id,
            });
        }

        return NextResponse.json({ ok: true, warning: externalIdSynced ? null : "External ID sync pending." });
    } catch (err) {
        console.error("Push register error:", err);
        return NextResponse.json(
            { ok: false, error: "Terjadi gangguan. Silakan coba lagi." },
            { status: 503 }
        );
    }
}
