import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST() {
    try {
        await destroySession();

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Logout error:", err);
        return NextResponse.json(
            { ok: false, error: "Gagal logout. Silakan coba lagi." },
            { status: 500 }
        );
    }
}
