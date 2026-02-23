import { SessionOptions, getIronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
    nis: string;
    nama_siswa: string;
    jenjang: string;
    isLoggedIn: boolean;
}

const sessionOptions: SessionOptions = {
    password: getSessionPassword(),
    cookieName: "mykahfi_session",
    cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: 60 * 60 * 24 * 7, // 7 days
    },
};

function getSessionPassword(): string {
    const password = process.env.SESSION_SECRET;
    if (!password || password.length < 32) {
        throw new Error("SESSION_SECRET must be set and at least 32 characters long");
    }
    return password;
}

export async function getSession() {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    return session;
}

export async function destroySession() {
    const session = await getSession();
    session.destroy();
}
