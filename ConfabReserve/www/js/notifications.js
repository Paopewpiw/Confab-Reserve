
(function () {
    document.addEventListener('deviceready', initializeFirebaseNotifications, false);

    let currentFCMToken = null;

    function initializeFirebaseNotifications() {
        console.log('[Firebase] Cordova is ready.');

        if (!window.FirebasexMessaging) {
            console.error('[Firebase] Messaging plugin is unavailable.');
            return;
        }

        const messaging = window.FirebasexMessaging;

        // Watch for login, logout, and restored sessions.
        if (window.ConfabAuthService) {
            window.ConfabAuthService.onAuthStateChange(function (event, session) {
                console.log('[Firebase] Auth event:', event);

                // Avoid making Supabase queries inside the auth callback.
                setTimeout(function () {
                    if (session && session.user && currentFCMToken) {
                        saveDeviceToken(session.user.id, currentFCMToken);
                    }
                }, 0);
            });
        }

        // Listen for refreshed FCM tokens.
        messaging.onTokenRefresh(
            function (token) {
                if (token) {
                    console.log('[Firebase] FCM token refreshed.');
                    currentFCMToken = token;
                    window.ConfabNotificationToken = token;
                    saveTokenForCurrentUser(token);
                }
            },
            function (error) {
                console.error('[Firebase] Token refresh error:', error);
            }
        );

        // Listen for incoming notifications.
        messaging.onMessageReceived(
            function (message) {
                console.log('[Firebase] Notification received:', message);

                if (message.tap) {
                    console.log('[Firebase] Notification tapped:', message.tap);
                }
            },
            function (error) {
                console.error('[Firebase] Message listener error:', error);
            }
        );

        // Request notification permission.
        messaging.grantPermission(
            function (granted) {
                console.log('[Firebase] Notification permission:', granted);

                if (granted) {
                    retrieveFCMToken(messaging);
                } else {
                    console.warn('[Firebase] Notification permission denied.');
                }
            },
            function (error) {
                console.error('[Firebase] Permission request failed:', error);
            }
        );
    }

    function retrieveFCMToken(messaging) {
        messaging.getToken(
            function (token) {
                if (token) {
                    console.log('[Firebase] FCM token retrieved.');
                    currentFCMToken = token;
                    window.ConfabNotificationToken = token;
                    saveTokenForCurrentUser(token);
                } else {
                    console.log('[Firebase] Token not available yet. Waiting for refresh.');
                }
            },
            function (error) {
                console.error('[Firebase] Could not retrieve FCM token:', error);
            }
        );
    }

    async function saveTokenForCurrentUser(token) {
        try {
            const auth = window.ConfabAuthService;
            if (!auth) return;

            const { data, error } = await auth.getClient().auth.getSession();

            if (error) throw error;

            const user = data.session?.user;

            // A guest can receive a token before logging in.
            // It will be saved after authentication.
            if (!user) {
                console.log('[Firebase] No logged-in user yet. Token will be saved after login.');
                return;
            }

            await saveDeviceToken(user.id, token);
        } catch (error) {
            console.error('[Firebase] Could not check current session:', error);
        }
    }

    async function saveDeviceToken(userId, token) {
        try {
            const supabase = window.ConfabAuthService.getClient();

            const { error } = await supabase
                .from('device_tokens')
                .upsert(
                    {
                        user_id: userId,
                        fcm_token: token,
                        device_type: 'android',
                        updated_at: new Date().toISOString()
                    },
                    { onConflict: 'fcm_token' }
                );

            if (error) throw error;

            console.log('[Firebase] Device token successfully saved to Supabase.');
               } catch (error) {
            console.error('[Firebase] Device token registration failed.');
            console.error('[Firebase] Error message:', error?.message);
            console.error('[Firebase] Error code:', error?.code);
            console.error('[Firebase] Error details:', error?.details);
            console.error('[Firebase] Error hint:', error?.hint);
            console.error('[Firebase] Full error:', JSON.stringify(error));
        }
    }
})();

