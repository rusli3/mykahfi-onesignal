import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/onesignal";
import { supabase } from "@/lib/supabase";

type MessageRecord = {
    nis?: string;
    msg_app?: string | null;
    message_text?: string | null;
    message?: string | null;
    text?: string | null;
};

type WebhookPayload = {
    type?: string;
    table?: string;
    schema?: string;
    nis?: string;
    msg_app?: string | null;
    // some trigger/webhook formats
    new?: MessageRecord;
    new_record?: MessageRecord;
    old?: MessageRecord;
    record?: MessageRecord;
    old_record?: MessageRecord;
    payload?: {
        nis?: string;
        msg_app?: string | null;
        message_text?: string | null;
        message?: string | null;
        text?: string | null;
        table?: string;
        record?: MessageRecord;
        old_record?: MessageRecord;
    };
};

function getAcceptedWebhookSecrets(): string[] {
    const candidates = [
        process.env.SUPABASE_WEBHOOK_SECRET,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    ]
        .map((value) => String(value || "").trim())
        .filter(Boolean);

    return Array.from(new Set(candidates));
}

function normalizeMessage(value: string | null | undefined): string {
    return String(value || "").trim();
}

function toNotificationBody(message: string): string {
    const clean = message.replace(/\s+/g, " ").trim();
    if (clean.length <= 120) return clean;
    return `${clean.slice(0, 117)}...`;
}

function pickMessage(record: MessageRecord | undefined): string {
    if (!record) return "";
    return normalizeMessage(
        record.msg_app ?? record.message_text ?? record.message ?? record.text
    );
}

function detectMessageField(record: MessageRecord | undefined): string {
    if (!record) return "msg_app";
    if (record.message_text !== undefined) return "message_text";
    if (record.msg_app !== undefined) return "msg_app";
    if (record.message !== undefined) return "message";
    if (record.text !== undefined) return "text";
    return "msg_app";
}

function parseBearerToken(authorizationHeader: string): string {
    if (!authorizationHeader) return "";
    if (!authorizationHeader.toLowerCase().startsWith("bearer ")) return "";
    return authorizationHeader.slice(7).trim();
}

function parseWebhookPayload(input: unknown): WebhookPayload {
    if (!input) return {};
    if (typeof input === "string") {
        try {
            return JSON.parse(input) as WebhookPayload;
        } catch {
            return {};
        }
    }
    if (typeof input !== "object") return {};
    return input as WebhookPayload;
}

export async function POST(request: Request) {
    try {
        const acceptedSecrets = getAcceptedWebhookSecrets();
        if (acceptedSecrets.length === 0) {
            throw new Error(
                "Missing webhook auth secret: set SUPABASE_WEBHOOK_SECRET or SUPABASE_SERVICE_ROLE_KEY"
            );
        }

        const incomingSecret = request.headers.get("x-webhook-secret") || "";
        const bearerToken = parseBearerToken(request.headers.get("authorization") || "");

        const isAuthorized = acceptedSecrets.some(
            (secret) => incomingSecret === secret || bearerToken === secret
        );
        if (!isAuthorized) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "Unauthorized webhook",
                    detail: "Invalid webhook secret or bearer token",
                },
                { status: 401 }
            );
        }

        const requestClone = request.clone();
        const rawPayload = await request
            .json()
            .catch(async () => await requestClone.text().catch(() => ""));
        const payload = parseWebhookPayload(rawPayload);

        const envelope = payload.payload && typeof payload.payload === "object"
            ? payload.payload
            : undefined;

        const record: MessageRecord =
            envelope?.record ||
            payload.record ||
            payload.new_record ||
            payload.new ||
            envelope ||
            payload;
        const oldRecord: MessageRecord =
            envelope?.old_record || payload.old_record || payload.old || {};

        const nis = String(record.nis || payload.nis || envelope?.nis || "").trim();
        const payloadMessage = pickMessage(payload);
        const envelopeMessage = pickMessage(envelope);
        const newMessage =
            pickMessage(record) || payloadMessage || envelopeMessage;
        const oldMessage = pickMessage(oldRecord);
        const webhookTable = String(payload.table || envelope?.table || "").trim() || null;
        const messageField = detectMessageField(record);

        if (!nis) {
            return NextResponse.json({ ok: true, skipped: "missing_nis" });
        }

        if (!newMessage) {
            return NextResponse.json({
                ok: true,
                skipped: "empty_message",
                payload_keys: Object.keys(payload || {}),
            });
        }

        if (oldMessage && newMessage === oldMessage) {
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
                source:
                    webhookTable
                        ? `${webhookTable}.${messageField}`
                        : messageField === "msg_app"
                            ? "users.msg_app"
                            : `user_messages_web.${messageField}`,
                webhook_type: payload.type || null,
                webhook_table: webhookTable,
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
