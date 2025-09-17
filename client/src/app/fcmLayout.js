'use client';
import { useEffect } from "react";
import { requestFCMToken, initOnMessageListener } from "@/lib/FirebaseAPI";

export default function RootLayout({ children }) {
    useEffect(() => {
        // 토큰 발급
        requestFCMToken();

        // 포그라운드 알림 리스너
        initOnMessageListener();

        // 서비스워커 등록
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {
            });
        }

    }, []);

    return (
        <html lang="en">
        <body>{children}</body>
        </html>
    );
}
