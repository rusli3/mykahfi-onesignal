"use client";

import { useEffect, useRef } from "react";

interface OneSignalInitProps {
    nis: string;
}

function detectPlatform(): string {
    if (typeof navigator === "undefined") return "desktop_web";
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isiOS) return "ios_web";
    if (/Android/.test(ua)) return "android_web";
    return "desktop_web";
}

export default function OneSignalInit({ nis }: OneSignalInitProps) {
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        if (!appId || appId === "your-onesignal-app-id") {
            console.log("[OneSignal] App ID not configured, skipping init.");
            return;
        }

        async function initOneSignal() {
            try {
                // Dynamically load OneSignal SDK
                const OneSignalModule = await import("react-onesignal");
                const OneSignal = OneSignalModule.default;

                await OneSignal.init({
                    appId: appId!,
                    allowLocalhostAsSecureOrigin: process.env.NODE_ENV === "development",
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    notifyButton: { enable: false } as any,
                });

                // Set external user ID
                await OneSignal.login(nis);

                // Get subscription ID and register device
                const subscriptionId = await OneSignal.User.PushSubscription.id;
                if (subscriptionId) {
                    await registerDevice(nis, subscriptionId);
                }

                // Listen for subscription changes
                OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
                    const newId = event.current?.id;
                    if (newId) {
                        await registerDevice(nis, newId);
                    }
                });

                console.log("[OneSignal] Initialized successfully for NIS:", nis);
            } catch (err) {
                console.error("[OneSignal] Init error:", err);
            }
        }

        initOneSignal();
    }, [nis]);

    async function registerDevice(nis: string, subscriptionId: string) {
        try {
            await fetch("/api/push/register-device", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nis,
                    onesignal_subscription_id: subscriptionId,
                    platform: detectPlatform(),
                    external_id: nis,
                }),
            });
        } catch (err) {
            console.error("[OneSignal] Device register error:", err);
        }
    }

    return null; // This component only runs effects, no UI
}
