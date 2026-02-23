import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/session";

const protectedPaths = ["/dashboard"];

function getSessionPassword(): string {
    const password = process.env.SESSION_SECRET;
    if (!password || password.length < 32) {
        throw new Error("SESSION_SECRET must be set and at least 32 characters long");
    }
    return password;
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if this is a protected page route
    const isProtectedPage = protectedPaths.some((path) =>
        pathname.startsWith(path)
    );

    if (!isProtectedPage) {
        return NextResponse.next();
    }

    // Read session from cookie
    const response = NextResponse.next();
    const session = await getIronSession<SessionData>(request, response, {
        password: getSessionPassword(),
        cookieName: "mykahfi_session",
    });

    if (!session.isLoggedIn || !session.nis) {
        // Redirect to login for page routes
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("expired", "1");
        return NextResponse.redirect(loginUrl);
    }

    return response;
}

export const config = {
    matcher: ["/dashboard/:path*"],
};
