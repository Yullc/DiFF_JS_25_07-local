// src/lib/UserAPI.js
import axios from "axios";

/** EC2 배포 서버 주소 */
const BACKEND = "http://localhost:8080/api/DiFF";

/** axios custom **/
export const UserAPI = axios.create({
    baseURL: BACKEND,
    headers: { "Content-Type": "application/json" },
});



/** 요청 인터셉터: AccessToken 자동 첨부 */
UserAPI.interceptors.request.use(
    (config) => {
        const TOKEN_TYPE = localStorage.getItem("tokenType") || "Bearer";
        const ACCESS_TOKEN = localStorage.getItem("accessToken");
        if (ACCESS_TOKEN) {
            config.headers.Authorization = `${TOKEN_TYPE} ${ACCESS_TOKEN}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

/** AccessToken 갱신 */
const refreshAccessToken = async () => {
    const REFRESH_TOKEN = localStorage.getItem("refreshToken");
    if (!REFRESH_TOKEN) {
        return null;
    }

    try {
        const res = await axios.post(`${BACKEND}/auth/refresh`, {
            refreshToken: REFRESH_TOKEN,
        });

        const ACCESS_TOKEN = res.data.accessToken;
        const TOKEN_TYPE = localStorage.getItem("tokenType") || "Bearer";

        localStorage.setItem("accessToken", ACCESS_TOKEN);
        UserAPI.defaults.headers.Authorization = `${TOKEN_TYPE} ${ACCESS_TOKEN}`;

        return ACCESS_TOKEN;
    } catch (err) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/DiFF/member/login";
        return null;
    }
};

/** 응답 인터셉터: 토큰 만료 시 자동 재시도 */
UserAPI.interceptors.response.use(
    (res) => res,
    async (error) => {
        const originalRequest = error.config;
        if (
            (error.response?.status === 401 || error.response?.status === 403) &&
            !originalRequest._retry
        ) {
            originalRequest._retry = true;
            const newToken = await refreshAccessToken();
            if (newToken) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return UserAPI(originalRequest);
            }
        }
        return Promise.reject(error);
    }
);

// === Auth & 회원 관련 API ===

// 로그인
export const login = async ({ email, loginPw }) => {

    const res = await UserAPI.post("/auth/login", { email, loginPw });
    const { accessToken, refreshToken } = res.data;

    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("tokenType", "Bearer");

    return res.data;
};

// 회원가입
export const signUp = async ({ loginPw, checkLoginPw, nickName, email }) => {

    const res = await UserAPI.post("/auth/join", {
        loginPw,
        checkLoginPw,
        nickName,
        email,
    });
    const { accessToken, refreshToken } = res.data;

    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("tokenType", "Bearer");

    return res.data;
};


// 회원 정보 조회
export const fetchUser = async (nickName) => {
    const response = await UserAPI.get(`/member/profile`, {
        params: nickName ? { nickName } : {},
    });
    return response.data;
};


// 5-4. 회원 수정
export const modifyNickName = async ({ nickName }) => {
    const data = { nickName };
    const response = await UserAPI.put(`/member/doModifyNickName`, data);
    return response.data;
};

export const modifyIntroduce = async ({ introduce }) => {
    const data = { introduce };
    const response = await UserAPI.put(`/member/doModifyIntroduce`, data);
    return response.data;
};

export const checkPwUser = async (data) => {
    const response = await UserAPI.put(`/member/checkPw`, data);
    return response.data;
}

// 5-5. 회원 탈퇴
export const deleteUser = async (id) => {
    const response = await UserAPI.delete(`/member/${id}`);
    return response.data;
};

// 닉네임으로 특정 회원 팔로잉 리스트 조회
export const getFollowingList = async (nickName) => {
    const url = nickName
        ? `/member/followingList?nickName=${encodeURIComponent(nickName)}`
        : `/member/followingList`;

    const response = await UserAPI.get(url);
    return response.data;
};

// 닉네임으로 특정 회원 팔로워 리스트 조회
export const getFollowerList = async (nickName) => {
    const url = nickName
        ? `/member/followerList?nickName=${encodeURIComponent(nickName)}`
        : `/member/followerList`;

    const response = await UserAPI.get(url);
    return response.data;
};

// 상대방을 팔로우
export const followMember = async (fromMemberId) => {
    const response = await UserAPI.post(`/member/follow`, null, {
        params: { fromMemberId },
    });
    return response.data;
};

// 상대방을 언팔로우
export const unfollowMember = async (fromMemberId) => {
    const response = await UserAPI.delete(`/member/unfollow`, {
        params: { fromMemberId },
    });
    return response.data;
};

export const uploadProfileImg = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await UserAPI.post(`/member/uploadProfileImg`, formData, {
            headers: {
                "Content-Type": "multipart/form-data",
                Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            },
        });
        return res.data;
    } catch (err) {
        console.error("업로드 실패:", err);
        throw err;
    }
};

export const requestPasswordReset = async (email) => {

    return axios.post(`/member/findPw`, null, {
        params: { email },
    });
};

export const updatePassword = async (token, newPw) => {

    return axios.post(`/member/updatePassword`, null, {
        params: { token, newPw },
    });
};

export const searchMembers = async (keyword) => {
    const res = await UserAPI.get(`/member/search`, { params: { keyword } });
    return res.data;
};
