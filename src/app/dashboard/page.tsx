"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import MonthCard from "@/components/MonthCard";
import TransactionDetail from "@/components/TransactionDetail";
import SchoolMessage from "@/components/SchoolMessage";
import PaymentGuide from "@/components/PaymentGuide";
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
    label: string;
    paid: boolean;
    transaction: Transaction | null;
}

interface Contact {
    unit: string;
    nohp: string;
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
    contacts: Contact[];
    error?: string;
}

export default function DashboardPage() {
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<Month | null>(null);

    const fetchDashboard = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/dashboard");
            const json = await res.json();

            if (res.status === 401) {
                router.push("/login?expired=1");
                return;
            }

            if (!json.ok) {
                setError(json.error || "Gagal memuat data.");
                return;
            }

            setData(json);
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
            router.push("/login");
        } catch {
            router.push("/login");
        }
    }

    // Determine which months are overdue
    function isOverdue(monthCode: string, paid: boolean): boolean {
        if (paid) return false;
        const currentMonth = new Date().getMonth(); // 0-indexed
        const monthMap: Record<string, number> = {
            JAN: 0, FEB: 1, MAR: 2, APR: 3, MEI: 4, JUN: 5,
            JUL: 6, AGU: 7, SEP: 8, OKT: 9, NOV: 10, DES: 11,
        };
        const mIdx = monthMap[monthCode];
        if (mIdx === undefined) return false;
        return mIdx <= currentMonth;
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
                    <button
                        className={`btn-refresh ${refreshing ? "spinning" : ""}`}
                        onClick={() => fetchDashboard(true)}
                        disabled={refreshing}
                    >
                        <span className="refresh-icon">↻</span>
                        {refreshing ? "Memuat..." : "Refresh"}
                    </button>
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

                {/* Payment Guide & Contacts */}
                <div className="section-title">
                    <span className="icon">📋</span>
                    Cara Pembayaran
                </div>
                <PaymentGuide contacts={data.contacts} />
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
