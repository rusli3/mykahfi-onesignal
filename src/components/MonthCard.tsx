"use client";

interface MonthCardProps {
    month: {
        code: string;
        label: string;
        paid: boolean;
    };
    overdue: boolean;
    onClick: () => void;
}

export default function MonthCard({ month, overdue, onClick }: MonthCardProps) {
    const status = month.paid ? "paid" : overdue ? "overdue" : "unpaid";

    return (
        <div className={`month-card ${status}`} onClick={onClick}>
            <div className="month-code">{month.code}</div>
            <div className="month-label">{month.label}</div>
            <div className="month-status">
                {month.paid ? "Lunas" : overdue ? "Belum" : "Belum"}
            </div>
        </div>
    );
}
