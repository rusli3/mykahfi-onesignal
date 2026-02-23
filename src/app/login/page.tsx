"use client";

import { Suspense, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const expired = searchParams.get("expired");

    const [nis, setNis] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(expired ? "Sesi telah berakhir. Silakan login kembali." : "");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nis: nis.trim(), password }),
            });

            const data = await res.json();

            if (!data.ok) {
                setError(data.error || "Login gagal. Silakan coba lagi.");
                setLoading(false);
                return;
            }

            router.push("/dashboard");
        } catch {
            setError("Terjadi gangguan koneksi. Periksa internet Anda dan coba lagi.");
            setLoading(false);
        }
    }

    return (
        <div className="login-card">
            <div className="login-logo">
                <h1>MyKahfi-WEB</h1>
                <p>Portal Wali Murid SIT Al Kahfi</p>
            </div>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="nis">NIS / Virtual Account</label>
                    <input
                        id="nis"
                        type="text"
                        className="form-input"
                        placeholder="Masukkan NIS atau VA"
                        value={nis}
                        onChange={(e) => setNis(e.target.value)}
                        autoComplete="username"
                        inputMode="numeric"
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        className="form-input"
                        placeholder="Masukkan password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        disabled={loading}
                    />
                </div>

                <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading || !nis || !password}
                >
                    {loading ? "Memproses..." : "Masuk"}
                </button>
            </form>
        </div>
    );
}

export default function LoginPage() {
    return (
        <div className="login-wrapper">
            <Suspense fallback={
                <div className="login-card">
                    <div className="login-logo">
                        <h1>MyKahfi-WEB</h1>
                        <p>Memuat...</p>
                    </div>
                </div>
            }>
                <LoginForm />
            </Suspense>
        </div>
    );
}
