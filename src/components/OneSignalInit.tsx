"use client";

import { useEffect, useRef } from "react";
import type { SubscriptionChangeEvent } from "react-onesignal";

interface OneSignalInitProps {
    nis: string;
    onStatusChange?: (status: OneSignalDebugStatus) => void;
}

export interface OneSignalDebugStatus {
    stage:
        | "idle"
        | "skipped"
        | "loading_sdk"
        | "initialized"
        | "logged_in"
        | "waiting_subscription"
        | "subscription_ready"
        | "registered"
        | "error";
    message: string;
    permission?: NotificationPermission | "unsupported";
    subscriptionId?: string | null;
    detail?: string;
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

export default function OneSignalInit({ nis, onStatusChange }: OneSignalInitProps) {
    const initialized = useRef(false);

    useEffect(() => {
        const emitStatus = (status: OneSignalDebugStatus) => {
            if (onStatusChange) onStatusChange(status);
        };

        if (initialized.current) return;
        initialized.current = true;
        let mounted = true;
        let cleanupSubscriptionListener: (() => void) | null = null;

        async function registerDevice(subscriptionId: string) {
            try {
                const res = await fetch("/api/push/register-device", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        nis,
                        onesignal_subscription_id: subscriptionId,
                        platform: detectPlatform(),
                        external_id: nis,
                    }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok || !json.ok) {
                    emitStatus({
                        stage: "error",
                        message: "Gagal register perangkat ke backend.",
                        permission:
                            typeof Notification !== "undefined"
                                ? Notification.permission
                                : "unsupported",
                        subscriptionId,
                        detail: json.error || `HTTP ${res.status}`,
                    });
                    return;
                }
                emitStatus({
                    stage: "registered",
                    message: "Perangkat berhasil didaftarkan.",
                    permission:
                        typeof Notification !== "undefined"
                            ? Notification.permission
                            : "unsupported",
                    subscriptionId,
                });
            } catch (err) {
                console.error("[OneSignal] Device register error:", err);
                emitStatus({
                    stage: "error",
                    message: "Error saat register perangkat.",
                    permission:
                        typeof Notification !== "undefined"
                            ? Notification.permission
                            : "unsupported",
                    subscriptionId,
                    detail: err instanceof Error ? err.message : "unknown",
                });
            }
        }

        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        if (!appId || appId === "your-onesignal-app-id") {
            console.log("[OneSignal] App ID not configured, skipping init.");
            emitStatus({
                stage: "skipped",
                message: "OneSignal App ID belum dikonfigurasi.",
                permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
            });
            return;
        }

        if (!canInitializeOneSignal()) {
            console.warn(
                "[OneSignal] Skipping init: OneSignal v16 requires HTTPS (except localhost)."
            );
            emitStatus({
                stage: "skipped",
                message: "OneSignal hanya bisa di HTTPS atau localhost.",
                permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
            });
            return;
        }

        async function initOneSignal() {
            try {
                emitStatus({
                    stage: "loading_sdk",
                    message: "Memuat SDK OneSignal...",
                    permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
                });

                // Dynamically load OneSignal SDK
                const OneSignalModule = await import("react-onesignal");
                const OneSignal = OneSignalModule.default;

                const workerChecks = await Promise.all([
                    fetch("/OneSignalSDKWorker.js", { method: "GET", cache: "no-store" }),
                    fetch("/OneSignalSDKUpdaterWorker.js", {
                        method: "GET",
                        cache: "no-store",
                    }),
                ]);

                const workerNotReady = workerChecks.some((res) => !res.ok);
                if (workerNotReady) {
                    emitStatus({
                        stage: "error",
                        message: "File service worker OneSignal tidak ditemukan.",
                        permission:
                            typeof Notification !== "undefined"
                                ? Notification.permission
                                : "unsupported",
                        detail: `Worker status: ${workerChecks
                            .map((res) => res.status)
                            .join(", ")}`,
                    });
                    return;
                }

                const baseInitConfig = {
                    appId: appId!,
                    allowLocalhostAsSecureOrigin: process.env.NODE_ENV === "development",
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    notifyButton: { enable: false } as any,
                };

                try {
                    await OneSignal.init({
                        ...baseInitConfig,
                        serviceWorkerPath: "/OneSignalSDKWorker.js",
                        serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
                        serviceWorkerParam: { scope: "/" },
                    });
                } catch (primaryInitError) {
                    const msg =
                        primaryInitError instanceof Error
                            ? primaryInitError.message
                            : String(primaryInitError);

                    // Treat duplicate init as non-fatal and continue.
                    if (msg.toLowerCase().includes("already initialized")) {
                        console.warn("[OneSignal] SDK already initialized, continuing flow.");
                    } else if (msg.toLowerCase().includes("service worker")) {
                        // Retry with SDK default worker strategy for desktop browsers.
                        try {
                            await OneSignal.init(baseInitConfig);
                        } catch (fallbackInitError) {
                            const fallbackMsg =
                                fallbackInitError instanceof Error
                                    ? fallbackInitError.message
                                    : String(fallbackInitError);
                            if (
                                !fallbackMsg.toLowerCase().includes("already initialized")
                            ) {
                                throw fallbackInitError;
                            }
                            console.warn(
                                "[OneSignal] SDK already initialized during fallback, continuing flow."
                            );
                        }
                    } else {
                        throw primaryInitError;
                    }
                }
                emitStatus({
                    stage: "initialized",
                    message: "SDK OneSignal berhasil diinisialisasi.",
                    permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
                });

                // Set external user ID
                await OneSignal.login(nis);
                emitStatus({
                    stage: "logged_in",
                    message: "OneSignal login external_id berhasil.",
                    permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
                });

                // Ensure push subscription exists for this browser profile.
                emitStatus({
                    stage: "waiting_subscription",
                    message: "Menyiapkan subscription push...",
                    permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
                });
                try {
                    const hasPermission =
                        typeof Notification !== "undefined" &&
                        Notification.permission === "granted";
                    if (!hasPermission) {
                        await OneSignal.Notifications.requestPermission();
                    }
                    if (!OneSignal.User.PushSubscription.optedIn) {
                        await OneSignal.User.PushSubscription.optIn();
                    }
                } catch (permissionErr) {
                    console.warn("[OneSignal] Permission/opt-in step warning:", permissionErr);
                }

                // Get subscription ID (with short retries) and register device
                let subscriptionId = await OneSignal.User.PushSubscription.id;
                if (!subscriptionId) {
                    for (let i = 0; i < 5; i += 1) {
                        await new Promise((resolve) => setTimeout(resolve, 500));
                        subscriptionId = await OneSignal.User.PushSubscription.id;
                        if (subscriptionId) break;
                    }
                }
                if (subscriptionId && mounted) {
                    emitStatus({
                        stage: "subscription_ready",
                        message: "Subscription ID ditemukan.",
                        permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
                        subscriptionId,
                    });
                    await registerDevice(subscriptionId);
                } else {
                    emitStatus({
                        stage: "error",
                        message: "Subscription ID belum tersedia di browser ini.",
                        permission:
                            typeof Notification !== "undefined"
                                ? Notification.permission
                                : "unsupported",
                        detail:
                            "Push permission boleh jadi granted, tapi subscription belum dibuat. Coba reload sekali lagi.",
                    });
                }

                // Listen for subscription changes
                const handleSubscriptionChange = async (event: SubscriptionChangeEvent) => {
                    const newId = event.current?.id;
                    if (newId && mounted) {
                        await registerDevice(newId);
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
                emitStatus({
                    stage: "error",
                    message: "Inisialisasi OneSignal gagal.",
                    permission:
                        typeof Notification !== "undefined"
                            ? Notification.permission
                            : "unsupported",
                    detail: err instanceof Error ? err.message : "unknown",
                });
            }
        }

        initOneSignal();

        return () => {
            mounted = false;
            if (cleanupSubscriptionListener) cleanupSubscriptionListener();
        };
    }, [nis, onStatusChange]);

    return null; // This component only runs effects, no UI
}
