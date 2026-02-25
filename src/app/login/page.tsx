"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const STORAGE_KEYS = {
    rememberNis: "mykahfi_remember_nis",
    savedNis: "mykahfi_saved_nis",
} as const;

function sanitizeNis(input: string): string {
    return input.replace(/\D/g, "").slice(0, 6);
}

function isNisValid(value: string): boolean {
    return /^\d{6}$/.test(value);
}

function EyeOpenIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M2 12C3.8 7.7 7.3 5 12 5C16.7 5 20.2 7.7 22 12C20.2 16.3 16.7 19 12 19C7.3 19 3.8 16.3 2 12Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
        </svg>
    );
}

function EyeClosedIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M3 3L21 21"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M10.6 5.2C11.1 5.1 11.5 5 12 5C16.7 5 20.2 7.7 22 12C21.2 13.9 20.1 15.5 18.7 16.7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M14.1 14.2C13.6 14.7 12.8 15 12 15C10.3 15 9 13.7 9 12C9 11.2 9.3 10.4 9.8 9.9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M6.2 6.2C4.5 7.5 3.1 9.4 2 12C3.8 16.3 7.3 19 12 19C13.9 19 15.5 18.6 17 17.9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const expired = searchParams.get("expired");

    const [nis, setNis] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(expired ? "Sesi telah berakhir. Silakan login kembali." : "");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberNis, setRememberNis] = useState(false);

    useEffect(() => {
        const remembered = localStorage.getItem(STORAGE_KEYS.rememberNis) === "1";
        setRememberNis(remembered);
        if (remembered) {
            const savedNis = localStorage.getItem(STORAGE_KEYS.savedNis) || "";
            setNis(sanitizeNis(savedNis));
        }
    }, []);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError("");

        const normalizedNis = sanitizeNis(nis);
        if (!isNisValid(normalizedNis)) {
            setError("NIS/VA harus 6 digit angka.");
            return;
        }

        if (!password) {
            setError("Password harus diisi.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nis: normalizedNis, password }),
            });

            const data = await res.json();
            if (!data.ok) {
                setError(data.error || "Login gagal. Silakan coba lagi.");
                return;
            }

            if (rememberNis) {
                localStorage.setItem(STORAGE_KEYS.rememberNis, "1");
                localStorage.setItem(STORAGE_KEYS.savedNis, normalizedNis);
            } else {
                localStorage.removeItem(STORAGE_KEYS.rememberNis);
                localStorage.removeItem(STORAGE_KEYS.savedNis);
            }

            router.push("/dashboard");
        } catch {
            setError("Terjadi gangguan koneksi. Periksa internet Anda dan coba lagi.");
        } finally {
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
                        placeholder="Masukkan 6 digit NIS/VA"
                        value={nis}
                        onChange={(e) => setNis(sanitizeNis(e.target.value))}
                        autoComplete="username"
                        inputMode="numeric"
                        maxLength={6}
                        pattern="\d{6}"
                        disabled={loading}
                    />
                    <div className="form-hint">NIS/VA hanya angka dan wajib 6 digit.</div>
                </div>

                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <div className="input-action-wrap">
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            className="form-input has-input-action"
                            placeholder="Masukkan password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            disabled={loading}
                        />
                        <button
                            type="button"
                            className="input-action-btn"
                            onClick={() => setShowPassword((prev) => !prev)}
                            disabled={loading}
                            aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                            title={showPassword ? "Sembunyikan password" : "Lihat password"}
                        >
                            {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                        </button>
                    </div>
                </div>

                <div className="login-options">
                    <label className="check-option">
                        <input
                            type="checkbox"
                            checked={rememberNis}
                            onChange={(e) => setRememberNis(e.target.checked)}
                            disabled={loading}
                        />
                        <span>Ingat NIS/VA di perangkat ini</span>
                    </label>
                </div>

                <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading || !isNisValid(nis) || !password}
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
            <Suspense
                fallback={
                    <div className="login-card">
                        <div className="login-logo">
                            <h1>MyKahfi-WEB</h1>
                            <p>Memuat...</p>
                        </div>
                    </div>
                }
            >
                <LoginForm />
            </Suspense>
        </div>
    );
}
