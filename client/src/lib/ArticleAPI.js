// lib/ArticleAPI.js
import axios from "axios";
import {DraftAPI} from "@/lib/DraftAPI";
import { UserAPI } from "@/lib/UserAPI";
import {ReflectAdapter as RepositoryAPI} from "next/dist/server/web/spec-extension/adapters/reflect";

/** EC2 배포 서버 주소 (api/DiFF 까지 포함) */
const BACKEND = "http://localhost:8080/api/DiFF";

/** axios custom **/
export const ArticleAPI = axios.create({
    baseURL: BACKEND,
    headers: { "Content-Type": "application/json" },
});
ArticleAPI.interceptors.request.use(
    (config) => {
        if (typeof window !== "undefined") {
            const TOKEN_TYPE = localStorage.getItem("tokenType") || "Bearer";
            const ACCESS_TOKEN = localStorage.getItem("accessToken");
            // console.log("📦 accessToken:", ACCESS_TOKEN);

            if (ACCESS_TOKEN) {
                config.headers['Authorization'] = `${TOKEN_TYPE} ${ACCESS_TOKEN}`;
            }

            const REFRESH_TOKEN = localStorage.getItem("refreshToken");
            // console.log("📦 refreshToken:", REFRESH_TOKEN);
            // console.log("🚀 최종 요청 헤더:", config.headers);
        }
        return config;
    },
    (error) => Promise.reject(error)
);


export const setAuthHeader = () => {
    if (typeof window !== "undefined") {
        const TOKEN_TYPE = localStorage.getItem("tokenType") || 'Bearer';
        const ACCESS_TOKEN = localStorage.getItem("accessToken");
        const REFRESH_TOKEN = localStorage.getItem("refreshToken");

        // accessToken이 있을 때만 Authorization 헤더 설정
        if (ACCESS_TOKEN) {
            ArticleAPI.defaults.headers['Authorization'] = `${TOKEN_TYPE} ${ACCESS_TOKEN}`;
        } else {
            delete ArticleAPI.defaults.headers['Authorization'];  // 없으면 제거
        }

        // refreshToken도 마찬가지
        if (REFRESH_TOKEN) {
            ArticleAPI.defaults.headers['REFRESH_TOKEN'] = REFRESH_TOKEN;
        } else {
            delete ArticleAPI.defaults.headers['REFRESH_TOKEN'];  // 없으면 제거
        }
    }
};


/** 3. 토큰 자동 재발급 (Refresh) */
const refreshAccessToken = async () => {
    if (typeof window !== "undefined") {
        const REFRESH_TOKEN = localStorage.getItem("refreshToken");
        const response = await axios.get(`${BACKEND}/auth/refresh`, {
            headers: { 'REFRESH_TOKEN': REFRESH_TOKEN }
        });
        const ACCESS_TOKEN = response.data.accessToken;
        const TOKEN_TYPE = localStorage.getItem("tokenType");
        localStorage.setItem('accessToken', ACCESS_TOKEN);
        ArticleAPI.defaults.headers['Authorization'] = `${TOKEN_TYPE} ${ACCESS_TOKEN}`;
    }
};

/** 4. 인터셉터로 토큰 만료 자동 처리 */
ArticleAPI.interceptors.response.use(
    response => response,
    async error => {
        const originalRequest = error.config;
        if (
            error.response &&
            (error.response.status === 403 || error.response.status === 401) &&
            !originalRequest._retry
        ) {
            originalRequest._retry = true;
            await refreshAccessToken();
            setAuthHeader();
            return ArticleAPI(originalRequest);
        }
        return Promise.reject(error);
    }
);

function normalizeArticlePayload(data) {
    const payload = { ...(data || {}) };

    // 숫자 필드 정규화
    if (payload.repositoryId != null) payload.repositoryId = Number(payload.repositoryId);
    if (payload.draftId != null) payload.draftId = Number(payload.draftId);

    // checksum 동의어 흡수 → payload.checksum 으로 고정
    const foundChecksum =
        payload.checksum ??
        payload.commitHash ??
        payload.commit_id ??
        payload.commitId ??
        payload.latestCommit ??
        null;

    if (typeof foundChecksum === "string" && foundChecksum.trim()) {
        payload.checksum = foundChecksum.trim();
    }
    // 중복 키 제거(백엔드가 checksum만 받게 깔끔히)
    delete payload.commitHash;
    delete payload.commit_id;
    delete payload.commitId;
    delete payload.latestCommit;

    return payload;
}

/** 5. Auth/회원 관련 API들 */
export const fetchArticles = async ({ repositoryId, repoId, searchItem = 0, keyword = "", page = 1 }) => {
    const rid = repositoryId ?? repoId;
    const res = await ArticleAPI.get('/article/list', {
        params: { repositoryId: rid, searchItem, keyword, page }

    });
    return res.data;
};

/** 트렌딩 글 */
export const trendingArticle = async ({ count, days }) => {
    const res = await ArticleAPI.get('/article/trending', {
        params: { count, days }
    });
    return res.data;
};


/** 글 작성 */
export const writeArticle = async (data) => {
    if (data?.repositoryId != null) data = { ...data, repositoryId: Number(data.repositoryId) };
    if (data?.draftId != null) data = { ...data, draftId: Number(data.draftId) };

    const res = await ArticleAPI.post('/article/doWrite', data);
    return res.data; // ResultData
};

/** 내 레포지토리 조회 */
export const getMyRepositories = async () => {
    const res = await ArticleAPI.get('/repository/my');
    const repos = res.data?.data1?.repositories ?? res.data?.repositories ?? [];
    return Array.isArray(repos) ? repos : [];
};

/** 평균 메트릭 조회 */
export const getAverageMetrics = async (repositoryId) => {
    const res = await ArticleAPI.get(`/repository/average/${repositoryId}`);
    return res.data;
};

/** 글 상세 조회 */
export const getArticle = async (id) => {
    const res = await ArticleAPI.get('/article/detail', { params: { id } });
    return res.data.data1;
}

/** 글 수정 */
export const modifyArticle = async (article, token) => {
    const res = await ArticleAPI.post('/article/modify', article, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` // 🔑 토큰 추가
        }
    });
    return res.data;
}

export const deleteArticle = async (id) => {
    const url = `/article/${id}`;
    const res = await DraftAPI.delete(url);
    return { status: res.status, data: res.data };
};

export const followingArticleList = async ({ repositoryId, searchItem = 0, keyword = "", page = 1 }) => {
    const res = await ArticleAPI.get('/article/followingArticleList', {
        params: { repositoryId, searchItem, keyword, page }
    });
    return res.data;
};

/** 특정 레포의 글 목록 */
export const repositoryArticles = async ({ repositoryId }) => {
    const res = await ArticleAPI.get('/repository/articles', { params: { repositoryId } });
    return res.data;
};

/** 댓글 작성 */
export const postReply = async (articleId, comment) => {
    const res = await UserAPI.post('/reply/doWrite', { articleId, body: comment });
    return res.data;
};

/** 댓글 목록 조회 */
export const fetchReplies = async (articleId) => {
    const res = await UserAPI.get('/reply/list', { params: { articleId } });
    return res.data;
};

/** 조회수 증가 */
export const increaseArticleHits = async (articleId) => {
    const res = await ArticleAPI.post(`/article/hits/${articleId}`);
    return res.data;
};

export const searchArticles = async (keyword) => {
    const res = await ArticleAPI.get('/article/search', { params: { keyword } });
    return res.data;
};