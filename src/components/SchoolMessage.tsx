"use client";

import { useState, useEffect } from "react";

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

// Convert URLs in text to clickable links
function linkifyText(text: string): string {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
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
            <div
                className="message-text"
                dangerouslySetInnerHTML={{ __html: linkifyText(message.text) }}
            />
        </div>
    );
}
