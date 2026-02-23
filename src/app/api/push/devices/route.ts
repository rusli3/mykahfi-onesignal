import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

function mask(value: string, keepStart = 4, keepEnd = 4): string {
    if (!value) return "";
    if (value.length <= keepStart + keepEnd) return "*".repeat(value.length);
    return `${value.slice(0, keepStart)}...${value.slice(-keepEnd)}`;
}

export async function GET() {
    try {
        const session = await getSession();
        const nis = session.nis;

        if (!nis) {
            return NextResponse.json(
                { ok: false, error: "Sesi tidak valid." },
                { status: 401 }
            );
        }

        const { data, error } = await supabase
            .from("user_devices_web")
            .select("*")
            .eq("nis", nis)
            .order("last_seen_at", { ascending: false });

        if (error) {
            return NextResponse.json(
                { ok: false, error: "Gagal memuat daftar perangkat." },
                { status: 503 }
            );
        }

        const devices = (data || []).map((row) => {
            const subscriptionId =
                typeof row.onesignal_subscription_id === "string"
                    ? row.onesignal_subscription_id
                    : "";

            return {
                platform: row.platform ?? null,
                is_active: row.is_active ?? null,
                external_id: row.external_id ?? null,
                subscription_id_masked: mask(subscriptionId),
                last_seen_at: row.last_seen_at ?? null,
                updated_at: row.updated_at ?? null,
                created_at: row.created_at ?? null,
            };
        });

        return NextResponse.json({
            ok: true,
            nis,
            total_devices: devices.length,
            active_devices: devices.filter((d) => d.is_active).length,
            devices,
        });
    } catch (err) {
        console.error("Push devices debug error:", err);
        return NextResponse.json(
            { ok: false, error: "Terjadi gangguan. Silakan coba lagi." },
            { status: 503 }
        );
    }
}
