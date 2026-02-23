import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

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
        const { nis, last_read_message_hash } = body;

        if (!nis || !last_read_message_hash) {
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

        // For now, store read status in localStorage on client side.
        // Future: persist to dedicated table.
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Mark read error:", err);
        return NextResponse.json(
            { ok: false, error: "Terjadi gangguan." },
            { status: 503 }
        );
    }
}
