// src/lib/reactionAPI.js
import axios from "axios";

/** EC2 배포 서버 주소 */
const BACKEND = "http://localhost:8080/api/DiFF";

/** axios custom **/
export const ReactionAPI = axios.create({
    baseURL: BACKEND,
    headers: { "Content-Type": "application/json" },
});

// JWT 자동 첨부
ReactionAPI.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const type = localStorage.getItem("tokenType") || "Bearer";
        const at = localStorage.getItem("accessToken");
        if (at) config.headers.Authorization = `${type} ${at}`;
    }
    return config;
});

/** 좋아요 ON */
export async function likeArticle(articleId) {
    const res = await ReactionAPI.post(`/article/like/${articleId}`);
    // { relType, relId, liked: true, count }
    return res.data;
}

/** 좋아요 OFF */
export async function unlikeArticle(articleId) {
    const res = await ReactionAPI.delete(`/article/like/${articleId}`);
    // { relType, relId, liked: false, count }
    return res.data;
}

/** 좋아요 상태/개수 조회 */
export async function fetchArticleLikes(articleId) {
    const res = await ReactionAPI.get(`/article/like/${articleId}`);
    return res.data;
}

/** 좋아요 ON */
export async function likeReply(replyId) {
    const res = await ReactionAPI.post(`/reply/like/${replyId}`);
    // { relType, relId, liked: true, count }
    return res.data;
}

/** 좋아요 OFF */
export async function unlikeReply(replyId) {
    const res = await ReactionAPI.delete(`/reply/like/${replyId}`);
    // { relType, relId, liked: false, count }
    return res.data;
}

/** 좋아요 상태/개수 조회 */
export async function fetchReplyLikes(replyId) {
    const res = await ReactionAPI.get(`/reply/like/${replyId}`);
    return res.data;
}