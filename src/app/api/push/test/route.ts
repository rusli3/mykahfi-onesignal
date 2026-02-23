import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getLastOneSignalAttempt, sendNotification } from "@/lib/onesignal";

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

        const body = await request.json().catch(() => ({}));
        const nis = String(body.nis || "").trim() || sessionNis;

        if (nis !== sessionNis) {
            return NextResponse.json(
                { ok: false, error: "NIS tidak sesuai sesi." },
                { status: 403 }
            );
        }

        const result = await sendNotification({
            externalUserIds: [nis],
            title: "Test Notifikasi",
            body: "Push OneSignal berhasil terhubung.",
            data: {
                event_type: "test",
                nis,
                deeplink: "/dashboard",
            },
        });

        if (!result.success) {
            const attempt = getLastOneSignalAttempt();
            return NextResponse.json(
                {
                    ok: false,
                    error: result.error || "Gagal mengirim test notifikasi.",
                    onesignal_attempt: attempt,
                },
                { status: 503 }
            );
        }

        return NextResponse.json({
            ok: true,
            notification_id: result.id,
        });
    } catch (err) {
        console.error("Push test error:", err);
        return NextResponse.json(
            { ok: false, error: "Terjadi gangguan. Silakan coba lagi." },
            { status: 503 }
        );
    }
}
