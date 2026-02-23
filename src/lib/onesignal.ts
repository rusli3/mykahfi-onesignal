function getOneSignalConfig(): { appId: string; restApiKey: string } {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim();
    const restApiKey = process.env.ONESIGNAL_REST_API_KEY?.trim();

    if (!appId || !restApiKey) {
        throw new Error("OneSignal environment variables are missing");
    }

    return { appId, restApiKey };
}

interface NotificationPayload {
    include_aliases: { external_id: string[] };
    target_channel: "push";
    headings: { en: string };
    contents: { en: string };
    data?: Record<string, string>;
}

type OneSignalAttempt = {
    endpoint: string;
    authScheme: "Key" | "Basic";
    status?: number;
    error?: string;
};

let lastSendAttempt: OneSignalAttempt | null = null;

export function getLastOneSignalAttempt(): OneSignalAttempt | null {
    return lastSendAttempt;
}

/**
 * Send a push notification via OneSignal REST API.
 */
export async function sendNotification(payload: {
    externalUserIds: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
}): Promise<{ success: boolean; id?: string; error?: string }> {
    const { appId, restApiKey } = getOneSignalConfig();
    const body: NotificationPayload = {
        include_aliases: { external_id: payload.externalUserIds },
        target_channel: "push",
        headings: { en: payload.title },
        contents: { en: payload.body },
        data: payload.data,
    };

    const attempts: Array<{ endpoint: string; authScheme: "Key" | "Basic"; auth: string }> = [
        {
            endpoint: "https://api.onesignal.com/notifications",
            authScheme: "Key",
            auth: `Key ${restApiKey}`,
        },
        {
            endpoint: "https://onesignal.com/api/v1/notifications",
            authScheme: "Basic",
            auth: `Basic ${restApiKey}`,
        },
    ];

    for (const attempt of attempts) {
        try {
            const response = await fetch(attempt.endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: attempt.auth,
                },
                body: JSON.stringify({
                    app_id: appId,
                    ...body,
                }),
            });

            const result = await response.json().catch(() => ({}));
            lastSendAttempt = {
                endpoint: attempt.endpoint,
                authScheme: attempt.authScheme,
                status: response.status,
                error: response.ok ? undefined : result.errors?.[0] || "Unknown error",
            };

            if (response.ok) {
                return { success: true, id: result.id };
            }

            // Fallback to next attempt for auth-related failures.
            if (response.status === 401 || response.status === 403) {
                continue;
            }

            return {
                success: false,
                error: result.errors?.[0] || `OneSignal error (${response.status})`,
            };
        } catch (error) {
            lastSendAttempt = {
                endpoint: attempt.endpoint,
                authScheme: attempt.authScheme,
                error: error instanceof Error ? error.message : "Network error",
            };
        }
    }

    return {
        success: false,
        error: lastSendAttempt?.error || "OneSignal authorization failed",
    };
}

/**
 * Set external_id for a OneSignal subscription.
 */
export async function setExternalId(
    subscriptionId: string,
    externalId: string
): Promise<boolean> {
    try {
        const { appId, restApiKey } = getOneSignalConfig();
        const response = await fetch(
            `https://onesignal.com/api/v1/players/${subscriptionId}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Basic ${restApiKey}`,
                },
                body: JSON.stringify({
                    app_id: appId,
                    external_user_id: externalId,
                }),
            }
        );

        return response.ok;
    } catch {
        return false;
    }
}
