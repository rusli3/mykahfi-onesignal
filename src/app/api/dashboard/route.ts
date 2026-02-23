import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";

// Academic months order: AGU through JUN
const ACADEMIC_MONTHS = [
    { code: "AGU", label: "Agustus" },
    { code: "SEP", label: "September" },
    { code: "OKT", label: "Oktober" },
    { code: "NOV", label: "November" },
    { code: "DES", label: "Desember" },
    { code: "JAN", label: "Januari" },
    { code: "FEB", label: "Februari" },
    { code: "MAR", label: "Maret" },
    { code: "APR", label: "April" },
    { code: "MEI", label: "Mei" },
    { code: "JUN", label: "Juni" },
];

export async function GET(request: Request) {
    try {
        const session = await getSession();
        const nis = session.nis;

        if (!nis) {
            return NextResponse.json(
                { ok: false, error: "Sesi tidak valid." },
                { status: 401 }
            );
        }

        // Fetch student info
        const { data: student, error: studentError } = await supabase
            .from("users")
            .select("nis, nama_siswa, jenjang, msg_app")
            .eq("nis", nis)
            .single();

        if (studentError || !student) {
            return NextResponse.json(
                { ok: false, error: "Gagal memuat data siswa." },
                { status: 503 }
            );
        }

        // Fetch transactions
        const { data: transactions, error: trxError } = await supabase
            .from("transactions")
            .select("idtrx, nis, bulan, nominal, tgl_trx, jenjang")
            .eq("nis", nis);

        if (trxError) {
            console.error("Transaction fetch error:", trxError);
        }

        // Build transaction lookup by month code
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const trxByMonth: Record<string, any> = {};
        if (transactions) {
            for (const trx of transactions) {
                if (trx.bulan) {
                    trxByMonth[String(trx.bulan).toUpperCase().substring(0, 3)] = trx;
                }
            }
        }

        // Build months array
        const months = ACADEMIC_MONTHS.map((month) => {
            const trx = trxByMonth[month.code];
            return {
                code: month.code,
                label: month.label,
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

        // Fetch admin contacts
        const { data: contacts } = await supabase
            .from("kontak_admin")
            .select("unit, nohp");

        // Build message object
        const message = student.msg_app
            ? {
                text: student.msg_app,
                isNew: true,
            }
            : null;

        return NextResponse.json({
            ok: true,
            student: {
                nis: student.nis,
                nama_siswa: student.nama_siswa,
                jenjang: student.jenjang,
            },
            message,
            months,
            contacts: contacts || [],
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
