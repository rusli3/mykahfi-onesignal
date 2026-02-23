"use client";

interface MonthCardProps {
    month: {
        code: string;
        paid: boolean;
    };
    overdue: boolean;
    onClick: () => void;
}

export default function MonthCard({ month, overdue, onClick }: MonthCardProps) {
    const status = month.paid ? "paid" : overdue ? "overdue" : "unpaid";

    return (
        <div className={`month-card ${status}`} onClick={onClick}>
            {status === "overdue" && <span className="month-overdue-dot" aria-label="Jatuh tempo terlewat" />}
            <div className="month-code">{month.code}</div>
            <div className="month-status">
                {month.paid ? "Lunas" : overdue ? "Belum" : "Belum"}
            </div>
        </div>
    );
}
