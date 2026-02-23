"use client";

interface Transaction {
    idtrx: number;
    nominal: number;
    tgl_trx: string;
    jenjang: string;
}

interface TransactionDetailProps {
    month: {
        code: string;
        label: string;
        paid: boolean;
        transaction: Transaction | null;
    };
    onClose: () => void;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

function formatDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    } catch {
        return dateStr;
    }
}

export default function TransactionDetail({ month, onClose }: TransactionDetailProps) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-handle" />
                <h2 className="modal-title">
                    Detail Pembayaran — {month.label}
                </h2>

                {month.paid && month.transaction ? (
                    <>
                        <div className="detail-row">
                            <span className="detail-label">Bulan</span>
                            <span className="detail-value">{month.label}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Nominal</span>
                            <span className="detail-value nominal">
                                {formatCurrency(month.transaction.nominal)}
                            </span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Tanggal Bayar</span>
                            <span className="detail-value">
                                {formatDate(month.transaction.tgl_trx)}
                            </span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Jenjang</span>
                            <span className="detail-value">{month.transaction.jenjang}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">ID Transaksi</span>
                            <span className="detail-value">{month.transaction.idtrx}</span>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: "center", padding: "24px 0" }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                            Belum ada data pembayaran untuk bulan {month.label}.
                        </p>
                    </div>
                )}

                <button className="btn-close" onClick={onClose}>
                    Tutup
                </button>
            </div>
        </div>
    );
}
