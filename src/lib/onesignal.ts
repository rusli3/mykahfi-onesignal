function getOneSignalConfig(): { appId: string; restApiKey: string } {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

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

/**
 * Send a push notification via OneSignal REST API.
 */
export async function sendNotification(payload: {
    externalUserIds: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const { appId, restApiKey } = getOneSignalConfig();
        const body: NotificationPayload = {
            include_aliases: { external_id: payload.externalUserIds },
            target_channel: "push",
            headings: { en: payload.title },
            contents: { en: payload.body },
            data: payload.data,
        };

        const response = await fetch(
            "https://api.onesignal.com/notifications",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Key ${restApiKey}`,
                },
                body: JSON.stringify({
                    app_id: appId,
                    ...body,
                }),
            }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            return { success: false, error: result.errors?.[0] || "Unknown error" };
        }

        return { success: true, id: result.id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Network error",
        };
    }
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
