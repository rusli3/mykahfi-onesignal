import { SessionOptions, getIronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
    nis: string;
    nama_siswa: string;
    jenjang: string;
    isLoggedIn: boolean;
}

const sessionOptions: SessionOptions = {
    password: process.env.SESSION_SECRET || "fallback-secret-change-me-immediately-32chars",
    cookieName: "mykahfi_session",
    cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: 60 * 60 * 24 * 7, // 7 days
    },
};

export async function getSession() {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    return session;
}

export async function destroySession() {
    const session = await getSession();
    session.destroy();
}
