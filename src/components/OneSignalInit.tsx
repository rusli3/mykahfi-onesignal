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
    onesignalId?: string | null;
    optedIn?: boolean;
    supported?: boolean;
    detail?: string;
}

async function waitForSubscriptionId(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oneSignal: any,
    retries = 40,
    intervalMs = 500
): Promise<string | null> {
    let subscriptionId = await oneSignal.User.PushSubscription.id;
    if (subscriptionId) return subscriptionId;

    for (let i = 0; i < retries; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        subscriptionId = await oneSignal.User.PushSubscription.id;
        if (subscriptionId) return subscriptionId;
    }

    return null;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let oneSignalRef: any = null;

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
                oneSignalRef = OneSignal;

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
                    ...(process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID
                        ? { safari_web_id: process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID }
                        : {}),
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
                    supported: OneSignal.Notifications.isPushSupported(),
                    optedIn: OneSignal.User.PushSubscription.optedIn,
                    onesignalId: OneSignal.User.onesignalId ?? null,
                });

                if (!OneSignal.Notifications.isPushSupported()) {
                    emitStatus({
                        stage: "error",
                        message: "Browser tidak mendukung Web Push untuk konfigurasi ini.",
                        permission:
                            typeof Notification !== "undefined"
                                ? Notification.permission
                                : "unsupported",
                        supported: false,
                        detail:
                            "Coba browser lain (Chrome/Edge terbaru) atau pastikan Safari macOS sudah versi yang mendukung Web Push.",
                    });
                    return;
                }

                // Set external user ID
                await OneSignal.login(nis);
                emitStatus({
                    stage: "logged_in",
                    message: "OneSignal login external_id berhasil.",
                    permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
                    supported: OneSignal.Notifications.isPushSupported(),
                    optedIn: OneSignal.User.PushSubscription.optedIn,
                    onesignalId: OneSignal.User.onesignalId ?? null,
                });

                // Listen for subscription changes as early as possible.
                const handleSubscriptionChange = async (event: SubscriptionChangeEvent) => {
                    const newId = event.current?.id;
                    if (newId && mounted) {
                        emitStatus({
                            stage: "subscription_ready",
                            message: "Subscription ID ditemukan.",
                            permission:
                                typeof Notification !== "undefined"
                                    ? Notification.permission
                                    : "unsupported",
                            subscriptionId: newId,
                        });
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

                // Ensure push subscription exists for this browser profile.
                emitStatus({
                    stage: "waiting_subscription",
                    message: "Menyiapkan subscription push...",
                    permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
                    supported: OneSignal.Notifications.isPushSupported(),
                    optedIn: OneSignal.User.PushSubscription.optedIn,
                    onesignalId: OneSignal.User.onesignalId ?? null,
                });
                try {
                    const hasPermission =
                        typeof Notification !== "undefined" &&
                        Notification.permission === "granted";
                    if (!hasPermission) {
                        try {
                            await OneSignal.Slidedown.promptPush();
                        } catch (promptErr) {
                            console.warn("[OneSignal] Slidedown prompt warning:", promptErr);
                        }
                        await OneSignal.Notifications.requestPermission();
                    }
                    if (!OneSignal.User.PushSubscription.optedIn) {
                        await OneSignal.User.PushSubscription.optIn();
                    }
                } catch (permissionErr) {
                    console.warn("[OneSignal] Permission/opt-in step warning:", permissionErr);
                }

                // Get subscription ID (with short retries) and register device
                const subscriptionId = await waitForSubscriptionId(OneSignal);
                if (subscriptionId && mounted) {
                    emitStatus({
                        stage: "subscription_ready",
                        message: "Subscription ID ditemukan.",
                        permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
                        subscriptionId,
                        supported: OneSignal.Notifications.isPushSupported(),
                        optedIn: OneSignal.User.PushSubscription.optedIn,
                        onesignalId: OneSignal.User.onesignalId ?? null,
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
                        supported: OneSignal.Notifications.isPushSupported(),
                        optedIn: OneSignal.User.PushSubscription.optedIn,
                        onesignalId: OneSignal.User.onesignalId ?? null,
                        detail:
                            "Permission sudah granted tapi browser belum menghasilkan subscription. Coba reload sekali, atau clear site data lalu login ulang.",
                    });
                }

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
                    supported: undefined,
                    optedIn: undefined,
                    onesignalId: null,
                    detail: err instanceof Error ? err.message : "unknown",
                });
            }
        }

        initOneSignal();

        const onManualEnablePush = async () => {
            if (!mounted || !oneSignalRef) return;
            try {
                emitStatus({
                    stage: "waiting_subscription",
                    message: "Mengaktifkan push dari aksi pengguna...",
                    permission:
                        typeof Notification !== "undefined"
                            ? Notification.permission
                            : "unsupported",
                    supported: oneSignalRef.Notifications.isPushSupported(),
                    optedIn: oneSignalRef.User.PushSubscription.optedIn,
                    onesignalId: oneSignalRef.User.onesignalId ?? null,
                });

                const hasPermission =
                    typeof Notification !== "undefined" &&
                    Notification.permission === "granted";
                if (!hasPermission) {
                    try {
                        await oneSignalRef.Slidedown.promptPush();
                    } catch (promptErr) {
                        console.warn("[OneSignal] Manual slidedown prompt warning:", promptErr);
                    }
                    await oneSignalRef.Notifications.requestPermission();
                }
                if (!oneSignalRef.User.PushSubscription.optedIn) {
                    await oneSignalRef.User.PushSubscription.optIn();
                }

                const subscriptionId = await waitForSubscriptionId(oneSignalRef, 20, 500);
                if (!subscriptionId) {
                    emitStatus({
                        stage: "error",
                        message: "Subscription ID belum tersedia di browser ini.",
                        permission:
                            typeof Notification !== "undefined"
                                ? Notification.permission
                                : "unsupported",
                        detail:
                            "Aksi manual sudah dijalankan, tapi browser belum membuat subscription.",
                    });
                    return;
                }

                emitStatus({
                    stage: "subscription_ready",
                    message: "Subscription ID ditemukan.",
                    permission:
                        typeof Notification !== "undefined"
                            ? Notification.permission
                            : "unsupported",
                    subscriptionId,
                    supported: oneSignalRef.Notifications.isPushSupported(),
                    optedIn: oneSignalRef.User.PushSubscription.optedIn,
                    onesignalId: oneSignalRef.User.onesignalId ?? null,
                });
                await registerDevice(subscriptionId);
            } catch (err) {
                emitStatus({
                    stage: "error",
                    message: "Aktivasi push manual gagal.",
                    permission:
                        typeof Notification !== "undefined"
                            ? Notification.permission
                            : "unsupported",
                    supported: oneSignalRef?.Notifications?.isPushSupported?.(),
                    optedIn: oneSignalRef?.User?.PushSubscription?.optedIn,
                    onesignalId: oneSignalRef?.User?.onesignalId ?? null,
                    detail: err instanceof Error ? err.message : "unknown",
                });
            }
        };

        window.addEventListener("mykahfi:enable-push", onManualEnablePush);

        return () => {
            window.removeEventListener("mykahfi:enable-push", onManualEnablePush);
            mounted = false;
            if (cleanupSubscriptionListener) cleanupSubscriptionListener();
        };
    }, [nis, onStatusChange]);

    return null; // This component only runs effects, no UI
}
