import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/onesignal";
import { supabase } from "@/lib/supabase";

type WebhookPayload = {
    type?: string;
    table?: string;
    schema?: string;
    record?: {
        nis?: string;
        msg_app?: string | null;
    };
    old_record?: {
        msg_app?: string | null;
    };
};

function getWebhookSecret(): string {
    const secret = process.env.SUPABASE_WEBHOOK_SECRET?.trim();
    if (!secret) {
        throw new Error("SUPABASE_WEBHOOK_SECRET is not configured");
    }
    return secret;
}

function normalizeMessage(value: string | null | undefined): string {
    return String(value || "").trim();
}

function toNotificationBody(message: string): string {
    const clean = message.replace(/\s+/g, " ").trim();
    if (clean.length <= 120) return clean;
    return `${clean.slice(0, 117)}...`;
}

export async function POST(request: Request) {
    try {
        const expectedSecret = getWebhookSecret();
        const incomingSecret = request.headers.get("x-webhook-secret") || "";

        if (incomingSecret !== expectedSecret) {
            return NextResponse.json(
                { ok: false, error: "Unauthorized webhook" },
                { status: 401 }
            );
        }

        const payload = (await request.json()) as WebhookPayload;
        const record = payload.record || {};
        const oldRecord = payload.old_record || {};

        const nis = String(record.nis || "").trim();
        const newMessage = normalizeMessage(record.msg_app);
        const oldMessage = normalizeMessage(oldRecord.msg_app);

        if (!nis) {
            return NextResponse.json({ ok: true, skipped: "missing_nis" });
        }

        if (!newMessage) {
            return NextResponse.json({ ok: true, skipped: "empty_message" });
        }

        if (newMessage === oldMessage) {
            return NextResponse.json({ ok: true, skipped: "unchanged_message" });
        }

        const sendResult = await sendNotification({
            externalUserIds: [nis],
            title: "Pesan Sekolah",
            body: toNotificationBody(newMessage),
            data: {
                event_type: "message",
                nis,
                deeplink: "/dashboard",
            },
        });

        const status = sendResult.success ? "sent" : "failed";

        // Best-effort notification log.
        await supabase.from("notification_logs").insert({
            nis,
            event_type: "message",
            provider: "onesignal",
            status,
            provider_message_id: sendResult.id || null,
            error_message: sendResult.success ? null : sendResult.error || "Unknown error",
            payload: {
                source: "users.msg_app",
                webhook_type: payload.type || null,
                webhook_table: payload.table || null,
                body_preview: toNotificationBody(newMessage),
            },
        });

        if (!sendResult.success) {
            return NextResponse.json(
                { ok: false, error: sendResult.error || "Push send failed" },
                { status: 503 }
            );
        }

        return NextResponse.json({ ok: true, notification_id: sendResult.id });
    } catch (err) {
        console.error("notify-message webhook error:", err);
        return NextResponse.json(
            { ok: false, error: "Webhook processing failed" },
            { status: 503 }
        );
    }
}
