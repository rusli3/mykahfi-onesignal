const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

interface NotificationPayload {
    include_external_user_ids: string[];
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
        const body: NotificationPayload = {
            include_external_user_ids: payload.externalUserIds,
            headings: { en: payload.title },
            contents: { en: payload.body },
            data: payload.data,
        };

        const response = await fetch(
            "https://onesignal.com/api/v1/notifications",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
                },
                body: JSON.stringify({
                    app_id: ONESIGNAL_APP_ID,
                    ...body,
                }),
            }
        );

        const result = await response.json();

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
        const response = await fetch(
            `https://onesignal.com/api/v1/players/${subscriptionId}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
                },
                body: JSON.stringify({
                    app_id: ONESIGNAL_APP_ID,
                    external_user_id: externalId,
                }),
            }
        );

        return response.ok;
    } catch {
        return false;
    }
}
