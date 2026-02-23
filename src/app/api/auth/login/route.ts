import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nis, password } = body;

        // Validate input
        if (!nis || !password) {
            return NextResponse.json(
                { ok: false, error: "NIS dan Password harus diisi." },
                { status: 400 }
            );
        }

        // Query user from Supabase
        const { data: user, error } = await supabase
            .from("users")
            .select("nis, password, nama_siswa, jenjang")
            .eq("nis", String(nis).trim())
            .single();

        if (error || !user) {
            return NextResponse.json(
                { ok: false, error: "NIS atau Password salah." },
                { status: 401 }
            );
        }

        // Compare password (plaintext comparison matching existing Android app)
        if (user.password !== password) {
            return NextResponse.json(
                { ok: false, error: "NIS atau Password salah." },
                { status: 401 }
            );
        }

        // Save session
        const session = await getSession();
        session.nis = user.nis;
        session.nama_siswa = user.nama_siswa;
        session.jenjang = user.jenjang;
        session.isLoggedIn = true;
        await session.save();

        // Update login audit fields
        const userAgent = request.headers.get("user-agent") || "unknown";
        await supabase
            .from("users")
            .update({
                last_login_at: new Date().toISOString(),
                last_login_device: userAgent.substring(0, 200),
                last_login_app_version: "web-1.0.0",
            })
            .eq("nis", user.nis);

        return NextResponse.json({
            ok: true,
            user: {
                nis: user.nis,
                nama_siswa: user.nama_siswa,
            },
        });
    } catch (err) {
        console.error("Login error:", err);
        return NextResponse.json(
            {
                ok: false,
                error: "Terjadi gangguan koneksi. Silakan coba lagi.",
            },
            { status: 503 }
        );
    }
}
