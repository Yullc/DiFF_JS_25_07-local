import axios from "axios";

/** EC2 배포 서버 주소 */
const BACKEND = "http://localhost:8080/api/DiFF";

/** axios custom **/
export const NotificationAPI = axios.create({
    baseURL: BACKEND,
    headers: { "Content-Type": "application/json" },
});

// JWT 자동 첨부
NotificationAPI.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const type = localStorage.getItem("tokenType") || "Bearer";
        const at = localStorage.getItem("accessToken");
        if (at) config.headers.Authorization = `${type} ${at}`;
    }
    return config;
});

/**
 * 안 읽은 알림 여부 (빨간 점 표시용)
 */
export async function hasUnread() {
    const res = await NotificationAPI.get("/notification/unread");
    return res.data; // true / false
}

/**
 * 알림 전체 가져오기
 */
export async function getNotifications() {
    const res = await NotificationAPI.get("/notification/list");
    return res.data; // [{id, type, message, isRead, regDate}, ...]
}

/**
 * 알림 전체 읽음 처리
 */
export async function markAllAsRead() {
    const res = await NotificationAPI.post("/notification/readAll");
    return res.data;
}

export async function updateNotificationSetting(type, enabled) {
    const res = await NotificationAPI.post("/notification/updateNotificationSetting", null, {
        params: { type, enabled },
    });
    return res.data;
}
