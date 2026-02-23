"use client";

import { useEffect, useRef } from "react";
import type { SubscriptionChangeEvent } from "react-onesignal";

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

function canInitializeOneSignal(): boolean {
    if (typeof window === "undefined") return false;
    const { protocol, hostname } = window.location;
    const isHttps = protocol === "https:";
    const isLocalhost =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1";
    return isHttps || isLocalhost;
}

export default function OneSignalInit({ nis }: OneSignalInitProps) {
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        let mounted = true;
        let cleanupSubscriptionListener: (() => void) | null = null;

        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        if (!appId || appId === "your-onesignal-app-id") {
            console.log("[OneSignal] App ID not configured, skipping init.");
            return;
        }

        if (!canInitializeOneSignal()) {
            console.warn(
                "[OneSignal] Skipping init: OneSignal v16 requires HTTPS (except localhost)."
            );
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
                if (subscriptionId && mounted) {
                    await registerDevice(nis, subscriptionId);
                }

                // Listen for subscription changes
                const handleSubscriptionChange = async (event: SubscriptionChangeEvent) => {
                    const newId = event.current?.id;
                    if (newId && mounted) {
                        await registerDevice(nis, newId);
                    }
                };
                OneSignal.User.PushSubscription.addEventListener("change", handleSubscriptionChange);
                cleanupSubscriptionListener = () => {
                    OneSignal.User.PushSubscription.removeEventListener(
                        "change",
                        handleSubscriptionChange
                    );
                };

                console.log("[OneSignal] Initialized successfully for NIS:", nis);
            } catch (err) {
                console.error("[OneSignal] Init error:", err);
            }
        }

        initOneSignal();

        return () => {
            mounted = false;
            if (cleanupSubscriptionListener) cleanupSubscriptionListener();
        };
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
