import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";

// Month order comes from bpi_sql_webhook_spb.sortasi:
// 1 JUL (ignored), 2 AGU, 3 SEP, 4 OKT, 5 NOV, 6 DES, 7 JAN, 8 FEB, 9 MAR, 10 APR, 11 MEI, 12 JUN
// Academic year used by dashboard: AGU - JUN (JUL is excluded).
const ACADEMIC_MONTHS = [
    { code: "AGU", sortasi: 2 },
    { code: "SEP", sortasi: 3 },
    { code: "OKT", sortasi: 4 },
    { code: "NOV", sortasi: 5 },
    { code: "DES", sortasi: 6 },
    { code: "JAN", sortasi: 7 },
    { code: "FEB", sortasi: 8 },
    { code: "MAR", sortasi: 9 },
    { code: "APR", sortasi: 10 },
    { code: "MEI", sortasi: 11 },
    { code: "JUN", sortasi: 12 },
];

const ACADEMIC_MONTH_CODES = ACADEMIC_MONTHS.map((month) => month.code);
const ACADEMIC_SORTASI = ACADEMIC_MONTHS.map((month) => month.sortasi);
const MONTH_CODE_BY_SORTASI = Object.fromEntries(
    ACADEMIC_MONTHS.map((month) => [month.sortasi, month.code])
) as Record<number, string>;

interface PaymentRow {
    idtrx: number;
    nominal: number;
    tgltrx: string;
    jenjang: string;
    sortasi: number | null;
}

interface LatestMessageRow {
    message_text: string | null;
    created_at: string;
}

async function fetchPaymentRows(nis: string): Promise<{
    rows: PaymentRow[];
    usedRpc: boolean;
    fallbackError: string | null;
}> {
    // Preferred: DB-side dedup to keep payload tiny (max 11 rows).
    const rpcResult = await supabase.rpc("get_latest_monthly_payments_for_dashboard", {
        p_nis: nis,
    });

    if (!rpcResult.error && rpcResult.data) {
        return {
            rows: (rpcResult.data as PaymentRow[]) || [],
            usedRpc: true,
            fallbackError: null,
        };
    }

    // Fallback for environments where RPC is not deployed yet.
    const fallbackResult = await supabase
        .from("bpi_sql_webhook_spb")
        .select("idtrx, nominal, tgltrx, jenjang, sortasi")
        .eq("nis", nis)
        .in("sortasi", ACADEMIC_SORTASI)
        .order("tgltrx", { ascending: false })
        .limit(250);

    return {
        rows: (fallbackResult.data as PaymentRow[]) || [],
        usedRpc: false,
        fallbackError: rpcResult.error?.message || null,
    };
}

async function fetchLatestSchoolMessage(nis: string): Promise<{
    text: string | null;
    source: "user_messages_web" | "users.msg_app" | "none";
    tableMissing: boolean;
}> {
    const latestMessageResult = await supabase
        .from("user_messages_web")
        .select("message_text, created_at")
        .eq("nis", nis)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (latestMessageResult.error && latestMessageResult.error.code !== "42P01") {
        console.warn("Dashboard message table query error:", latestMessageResult.error.message);
    }

    const messageRow = latestMessageResult.data as LatestMessageRow | null;
    const messageText = String(messageRow?.message_text || "").trim();
    if (messageText) {
        return {
            text: messageText,
            source: "user_messages_web",
            tableMissing: false,
        };
    }

    const tableMissing = latestMessageResult.error?.code === "42P01";

    // Transitional fallback for existing deployments that still use users.msg_app.
    const legacyMessageResult = await supabase
        .from("users")
        .select("msg_app")
        .eq("nis", nis)
        .single();

    if (legacyMessageResult.error) {
        throw new Error(`Legacy message query failed: ${legacyMessageResult.error.message}`);
    }

    const legacyText = String(legacyMessageResult.data?.msg_app || "").trim();
    if (legacyText) {
        return {
            text: legacyText,
            source: "users.msg_app",
            tableMissing,
        };
    }

    return {
        text: null,
        source: "none",
        tableMissing,
    };
}

export async function GET(request: Request) {
    try {
        const session = await getSession();
        const nis = session.nis;
        const { searchParams } = new URL(request.url);
        const includeDebug = searchParams.get("debug") === "1";

        if (!nis) {
            return NextResponse.json(
                { ok: false, error: "Sesi tidak valid." },
                { status: 401 }
            );
        }

        // Fetch minimum required data from Supabase to reduce egress.
        const [messageResult, paymentResult] = await Promise.all([
            fetchLatestSchoolMessage(nis),
            fetchPaymentRows(nis),
        ]);

        const {
            text: messageText,
            source: messageSource,
            tableMissing: messageTableMissing,
        } = messageResult;
        const { rows: transactions, usedRpc, fallbackError } = paymentResult;

        if (!usedRpc && fallbackError) {
            console.warn("Dashboard RPC unavailable, using fallback query:", fallbackError);
        }

        // Build transaction lookup by month code
        const trxByMonth: Record<
            string,
            { idtrx: number; nominal: number; tgl_trx: string; jenjang: string }
        > = {};

        if (transactions) {
            for (const trx of transactions) {
                const sortasiFromDb = Number(trx.sortasi);
                const codeFromSortasi = MONTH_CODE_BY_SORTASI[sortasiFromDb];
                if (!codeFromSortasi) {
                    // Ignore JUL or invalid sortasi outside AGU..JUN mapping.
                    continue;
                }

                if (ACADEMIC_MONTH_CODES.includes(codeFromSortasi) && !trxByMonth[codeFromSortasi]) {
                    trxByMonth[codeFromSortasi] = {
                        idtrx: trx.idtrx,
                        nominal: trx.nominal,
                        tgl_trx: trx.tgltrx,
                        jenjang: trx.jenjang,
                    };
                }
            }
        }

        // Build months array
        const months = ACADEMIC_MONTHS.map((month) => {
            const trx = trxByMonth[month.code];
            return {
                code: month.code,
                paid: !!trx,
                transaction: trx
                    ? {
                        idtrx: trx.idtrx,
                        nominal: trx.nominal,
                        tgl_trx: trx.tgl_trx,
                        jenjang: trx.jenjang,
                    }
                    : null,
            };
        });

        // Build message object
        const message = messageText
            ? {
                text: messageText,
                isNew: true,
            }
            : null;

        const response: {
            ok: boolean;
            student: { nis: string; nama_siswa: string; jenjang: string };
            message: { text: string; isNew: boolean } | null;
            months: typeof months;
            debug?: {
                mapping: Array<{
                    sortasi: number;
                    code: string;
                    paid: boolean;
                    idtrx: number | null;
                    tgltrx: string | null;
                }>;
                source_rows: Array<{
                    idtrx: number;
                    sortasi: number | null;
                    code: string | null;
                    tgltrx: string;
                    nominal: number;
                }>;
                message_source: string;
                message_table_missing: boolean;
            };
        } = {
            ok: true,
            student: {
                nis,
                nama_siswa: session.nama_siswa,
                jenjang: session.jenjang,
            },
            message,
            months,
        };

        if (includeDebug) {
            response.debug = {
                mapping: ACADEMIC_MONTHS.map(({ sortasi, code }) => {
                    const trx = trxByMonth[code];
                    return {
                        sortasi,
                        code,
                        paid: !!trx,
                        idtrx: trx?.idtrx ?? null,
                        tgltrx: trx?.tgl_trx ?? null,
                    };
                }),
                source_rows: (transactions || []).map((trx) => {
                    const sortasi = trx.sortasi === null ? null : Number(trx.sortasi);
                    const code = sortasi ? MONTH_CODE_BY_SORTASI[sortasi] || null : null;
                    return {
                        idtrx: trx.idtrx,
                        sortasi,
                        code,
                        tgltrx: trx.tgltrx,
                        nominal: trx.nominal,
                    };
                }),
                message_source: messageSource,
                message_table_missing: messageTableMissing,
            };
        }

        return NextResponse.json(response, {
            headers: {
                // Private short cache helps reduce repeated server invocations per user.
                "Cache-Control": "private, max-age=20, stale-while-revalidate=40",
            },
        });
    } catch (err) {
        console.error("Dashboard error:", err);
        return NextResponse.json(
            {
                ok: false,
                error: "Gagal memuat dashboard. Silakan coba lagi.",
            },
            { status: 503 }
        );
    }
}
