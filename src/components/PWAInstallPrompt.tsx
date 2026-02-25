"use client";

import { useState, useEffect } from "react";

export default function PWAInstallPrompt() {
    const [show, setShow] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if already installed as PWA
        const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window.navigator as any).standalone === true;

        if (isStandalone) return;

        // Check if dismissed recently
        const dismissed = localStorage.getItem("pwa_dismissed");
        if (dismissed) {
            const dismissedAt = parseInt(dismissed);
            const hoursSince = (Date.now() - dismissedAt) / (1000 * 60 * 60);
            if (hoursSince < 72) return;
        }

        // Detect iOS
        const ua = navigator.userAgent;
        const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        setIsIOS(isiOS);
        setShow(true);
    }, []);

    function dismiss() {
        localStorage.setItem("pwa_dismissed", String(Date.now()));
        setShow(false);
    }

    if (!show) return null;

    return (
        <div className="pwa-banner">
            <button className="pwa-dismiss" onClick={dismiss}>
                ✕
            </button>
            <h3>📲 Pasang Aplikasi MyKahfi-WEB</h3>
            {isIOS ? (
                <p>
                    Tap tombol <strong>Share</strong> (ikon kotak dengan panah ke atas) di bagian bawah Safari, lalu pilih <strong>&quot;Add to Home Screen&quot;</strong> agar aplikasi lebih cepat diakses.
                </p>
            ) : (
                <p>
                    Tap tombol <strong>Menu (⋮)</strong> di browser, lalu pilih <strong>&quot;Install app&quot;</strong> atau <strong>&quot;Add to Home Screen&quot;</strong> untuk pengalaman terbaik.
                </p>
            )}
        </div>
    );
}
