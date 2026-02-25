import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/onesignal";
import { supabase } from "@/lib/supabase";

type PaymentRecord = {
    row_number?: number | string | null;
    tgltrx?: string | null;
    tgl_trx?: string | null;
    idtrx?: number | string | null;
    idtag?: string | null;
    nominal?: number | string | null;
    nis?: string | null;
    nama?: string | null;
    bulan?: string | null;
    jenjang?: string | null;
    sortasi?: number | string | null;
};

type WebhookPayload = {
    type?: string;
    table?: string;
    schema?: string;
    record?: PaymentRecord;
    new_record?: PaymentRecord;
    new?: PaymentRecord;
    old_record?: PaymentRecord;
    old?: PaymentRecord;
    payload?: {
        type?: string;
        table?: string;
        schema?: string;
        record?: PaymentRecord;
        new_record?: PaymentRecord;
        new?: PaymentRecord;
        old_record?: PaymentRecord;
        old?: PaymentRecord;
    } & PaymentRecord;
} & PaymentRecord;

const MONTH_BY_SORTASI: Record<number, string> = {
    1: "JUL",
    2: "AGU",
    3: "SEP",
    4: "OKT",
    5: "NOV",
    6: "DES",
    7: "JAN",
    8: "FEB",
    9: "MAR",
    10: "APR",
    11: "MEI",
    12: "JUN",
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

function parseBearerToken(authorizationHeader: string): string {
    if (!authorizationHeader) return "";
    if (!authorizationHeader.toLowerCase().startsWith("bearer ")) return "";
    return authorizationHeader.slice(7).trim();
}

function parsePayload(input: unknown): WebhookPayload {
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

function normalizeText(value: unknown): string {
    return String(value || "").trim();
}

function normalizeNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function resolveMonthCode(record: PaymentRecord): string {
    const sortasi = normalizeNumber(record.sortasi);
    if (MONTH_BY_SORTASI[sortasi]) {
        return MONTH_BY_SORTASI[sortasi];
    }
    return normalizeText(record.bulan).toUpperCase();
}

function formatCurrency(amount: number): string {
    try {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return `Rp ${amount}`;
    }
}

function buildNotificationBody(amount: number, monthCode: string): string {
    const nominal = formatCurrency(amount);
    if (monthCode) {
        return `Pembayaran ${monthCode} sebesar ${nominal} sudah diterima.`;
    }
    return `Pembayaran baru sebesar ${nominal} sudah diterima.`;
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
        const raw = await request
            .json()
            .catch(async () => await requestClone.text().catch(() => ""));
        const payload = parsePayload(raw);
        const envelope = payload.payload && typeof payload.payload === "object"
            ? payload.payload
            : undefined;

        const record: PaymentRecord =
            envelope?.record ||
            envelope?.new_record ||
            envelope?.new ||
            payload.record ||
            payload.new_record ||
            payload.new ||
            envelope ||
            payload;

        const oldRecord: PaymentRecord =
            envelope?.old_record || envelope?.old || payload.old_record || payload.old || {};

        const nis = normalizeText(record.nis);
        const idtrx = normalizeText(record.idtrx);
        const idtag = normalizeText(record.idtag);
        const amount = normalizeNumber(record.nominal);
        const monthCode = resolveMonthCode(record);
        const oldAmount = normalizeNumber(oldRecord.nominal);
        const webhookType = normalizeText(payload.type || envelope?.type).toUpperCase();

        if (!nis) {
            return NextResponse.json({ ok: true, skipped: "missing_nis" });
        }

        if (!idtrx && !idtag) {
            return NextResponse.json({ ok: true, skipped: "missing_transaction_identity" });
        }

        // If webhook comes from update and no meaningful payment value changed, skip.
        if (webhookType === "UPDATE" && amount === oldAmount) {
            return NextResponse.json({ ok: true, skipped: "unchanged_payment" });
        }

        if (idtrx) {
            // Idempotency guard for webhook retries / duplicate insert forwarding.
            const duplicateCheck = await supabase
                .from("notification_logs")
                .select("id, payload")
                .eq("nis", nis)
                .eq("event_type", "payment")
                .eq("status", "sent")
                .order("created_at", { ascending: false })
                .limit(30);

            if (!duplicateCheck.error && duplicateCheck.data) {
                const alreadySent = duplicateCheck.data.some((row) => {
                    const payloadData =
                        row.payload && typeof row.payload === "object"
                            ? (row.payload as Record<string, unknown>)
                            : {};
                    return normalizeText(payloadData.idtrx) === idtrx;
                });

                if (alreadySent) {
                    return NextResponse.json({
                        ok: true,
                        skipped: "duplicate_transaction_notification",
                        idtrx,
                    });
                }
            }
        }

        const sendResult = await sendNotification({
            externalUserIds: [nis],
            title: "Pembayaran Baru",
            body: buildNotificationBody(amount, monthCode),
            data: {
                event_type: "payment",
                nis,
                idtrx: idtrx || "-",
                idtag: idtag || "-",
                month: monthCode || "-",
                nominal: String(amount),
                deeplink: "/dashboard",
            },
        });

        const status = sendResult.success ? "sent" : "failed";

        await supabase.from("notification_logs").insert({
            nis,
            event_type: "payment",
            provider: "onesignal",
            status,
            provider_message_id: sendResult.id || null,
            error_message: sendResult.success ? null : sendResult.error || "Unknown error",
            payload: {
                source: "bpi_sql_webhook_spb",
                webhook_type: webhookType || null,
                webhook_table: payload.table || envelope?.table || null,
                idtrx: idtrx || null,
                idtag: idtag || null,
                sortasi: normalizeNumber(record.sortasi) || null,
                month_code: monthCode || null,
                nominal: amount,
            },
        });

        if (!sendResult.success) {
            return NextResponse.json(
                { ok: false, error: sendResult.error || "Push send failed" },
                { status: 503 }
            );
        }

        return NextResponse.json({
            ok: true,
            notification_id: sendResult.id,
            idtrx: idtrx || null,
        });
    } catch (err) {
        console.error("notify-payment webhook error:", err);
        return NextResponse.json(
            { ok: false, error: "Webhook processing failed" },
            { status: 503 }
        );
    }
}
