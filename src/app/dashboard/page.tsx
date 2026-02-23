"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import MonthCard from "@/components/MonthCard";
import TransactionDetail from "@/components/TransactionDetail";
import SchoolMessage from "@/components/SchoolMessage";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import OneSignalInit from "@/components/OneSignalInit";

interface Transaction {
    idtrx: number;
    nominal: number;
    tgl_trx: string;
    jenjang: string;
}

interface Month {
    code: string;
    paid: boolean;
    transaction: Transaction | null;
}

interface DashboardData {
    ok: boolean;
    student: {
        nis: string;
        nama_siswa: string;
        jenjang: string;
    };
    message: {
        text: string;
        isNew: boolean;
    } | null;
    months: Month[];
    error?: string;
}

const ACADEMIC_MONTH_ORDER = ["AGU", "SEP", "OKT", "NOV", "DES", "JAN", "FEB", "MAR", "APR", "MEI", "JUN"];
const DASHBOARD_CACHE_KEY = "dashboard_cache_v1";
const DASHBOARD_CACHE_TTL_MS = 45 * 1000;

function readDashboardCache(): DashboardData | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { ts: number; data: DashboardData };
        if (!parsed?.ts || !parsed?.data) return null;
        if (Date.now() - parsed.ts > DASHBOARD_CACHE_TTL_MS) return null;
        return parsed.data;
    } catch {
        return null;
    }
}

function writeDashboardCache(data: DashboardData): void {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(
            DASHBOARD_CACHE_KEY,
            JSON.stringify({ ts: Date.now(), data })
        );
    } catch {
        // Ignore quota/storage errors.
    }
}

function clearDashboardCache(): void {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.removeItem(DASHBOARD_CACHE_KEY);
    } catch {
        // Ignore storage errors.
    }
}

function getCurrentAcademicMonthIndex(): number {
    const currentMonth = new Date().getMonth(); // 0-11

    // August-December maps to 0-4
    if (currentMonth >= 7) return currentMonth - 7;
    // January-June maps to 5-10
    if (currentMonth <= 5) return currentMonth + 5;
    // July is excluded from AGU-JUN academic year view.
    return -1;
}

export default function DashboardPage() {
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [testingPush, setTestingPush] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<Month | null>(null);

    const fetchDashboard = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError("");

        if (!isRefresh) {
            const cached = readDashboardCache();
            if (cached) {
                setData(cached);
                setLoading(false);
                return;
            }
        }

        try {
            const res = await fetch("/api/dashboard");
            const json = await res.json();

            if (res.status === 401) {
                clearDashboardCache();
                router.push("/login?expired=1");
                return;
            }

            if (!json.ok) {
                setError(json.error || "Gagal memuat data.");
                return;
            }

            setData(json);
            writeDashboardCache(json);
        } catch {
            setError("Gagal memuat data. Periksa koneksi internet Anda.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [router]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    async function handleLogout() {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            clearDashboardCache();
            router.push("/login");
        } catch {
            clearDashboardCache();
            router.push("/login");
        }
    }

    async function handleTestPush() {
        if (!data?.student.nis) return;
        setTestingPush(true);

        try {
            const res = await fetch("/api/push/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nis: data.student.nis }),
            });

            const json = await res.json();
            if (!json.ok) {
                const attempt = json.onesignal_attempt;
                const attemptInfo = attempt
                    ? `\nEndpoint: ${attempt.endpoint}\nAuth: ${attempt.authScheme}\nStatus: ${attempt.status ?? "-"}`
                    : "";
                alert((json.error || "Gagal mengirim test notifikasi.") + attemptInfo);
                return;
            }

            alert("Test notifikasi terkirim. Cek notifikasi di perangkat Anda.");
        } catch {
            alert("Gagal mengirim test notifikasi.");
        } finally {
            setTestingPush(false);
        }
    }

    // Determine which months are overdue
    function isOverdue(monthCode: string, paid: boolean): boolean {
        if (paid) return false;
        const academicNow = getCurrentAcademicMonthIndex();
        if (academicNow < 0) return false;
        const monthIdx = ACADEMIC_MONTH_ORDER.indexOf(monthCode);
        if (monthIdx < 0) return false;
        return monthIdx <= academicNow;
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner" />
                <p className="loading-text">Memuat dashboard...</p>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div style={{ padding: 20 }}>
                <div className="error-container">
                    <div className="error-icon">⚠️</div>
                    <p>{error}</p>
                    <button className="btn-retry" onClick={() => fetchDashboard()}>
                        Coba Lagi
                    </button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <>
            <OneSignalInit nis={data.student.nis} />

            {/* Header */}
            <header className="header">
                <div className="header-top">
                    <span className="header-title">MyKahfi-WEB</span>
                    <button className="btn-logout" onClick={handleLogout}>
                        Keluar
                    </button>
                </div>
                <div className="student-info">
                    <div className="student-name">{data.student.nama_siswa}</div>
                    <div className="student-detail">
                        NIS: {data.student.nis} · {data.student.jenjang}
                    </div>
                </div>
            </header>

            <div className="dashboard-content">
                {/* PWA Install Prompt */}
                <PWAInstallPrompt />

                {/* School Message */}
                <div className="section-title">
                    <span className="icon">💬</span>
                    Pesan Sekolah
                </div>
                <SchoolMessage message={data.message} nis={data.student.nis} />

                {/* Payment Months */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div className="section-title" style={{ marginBottom: 0 }}>
                        <span className="icon">📅</span>
                        Status Pembayaran
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            className={`btn-refresh ${refreshing ? "spinning" : ""}`}
                            onClick={() => fetchDashboard(true)}
                            disabled={refreshing}
                        >
                            <span className="refresh-icon">↻</span>
                            {refreshing ? "Memuat..." : "Refresh"}
                        </button>
                        <button
                            className="btn-refresh"
                            onClick={handleTestPush}
                            disabled={testingPush}
                        >
                            {testingPush ? "Mengirim..." : "Test Notif"}
                        </button>
                    </div>
                </div>

                <div className="month-grid">
                    {data.months.map((month) => (
                        <MonthCard
                            key={month.code}
                            month={month}
                            overdue={isOverdue(month.code, month.paid)}
                            onClick={() => setSelectedMonth(month)}
                        />
                    ))}
                </div>
            </div>

            {/* Transaction Detail Modal */}
            {selectedMonth && (
                <TransactionDetail
                    month={selectedMonth}
                    onClose={() => setSelectedMonth(null)}
                />
            )}
        </>
    );
}
