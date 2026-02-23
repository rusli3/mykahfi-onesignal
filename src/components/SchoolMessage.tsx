"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";

interface SchoolMessageProps {
    message: {
        text: string;
        isNew: boolean;
    } | null;
    nis: string;
}

// Simple hash function for message read tracking
function hashMessage(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return String(hash);
}

// Render clickable URLs without injecting raw HTML.
function renderTextWithLinks(text: string): ReactNode[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlCheckRegex = /^https?:\/\/[^\s]+$/;
    const parts = text.split(urlRegex);

    return parts.map((part, idx) => {
        if (urlCheckRegex.test(part)) {
            return (
                <a key={`link-${idx}`} href={part} target="_blank" rel="noopener noreferrer">
                    {part}
                </a>
            );
        }
        return <span key={`text-${idx}`}>{part}</span>;
    });
}

export default function SchoolMessage({ message, nis }: SchoolMessageProps) {
    const [isNew, setIsNew] = useState(false);

    useEffect(() => {
        if (!message) return;

        const storageKey = `msg_read_${nis}`;
        const lastReadHash = localStorage.getItem(storageKey);
        const currentHash = hashMessage(message.text);

        if (lastReadHash !== currentHash) {
            setIsNew(true);
        }
    }, [message, nis]);

    function markAsRead() {
        if (!message) return;
        const storageKey = `msg_read_${nis}`;
        const currentHash = hashMessage(message.text);
        localStorage.setItem(storageKey, currentHash);
        setIsNew(false);
    }

    if (!message || !message.text) {
        return <p className="no-message">Tidak ada pesan saat ini.</p>;
    }

    return (
        <div className="message-card" onClick={markAsRead}>
            {isNew && <span className="message-badge">Baru</span>}
            <div className="message-text">{renderTextWithLinks(message.text)}</div>
        </div>
    );
}
