import axios from "axios";

/** EC2 배포 서버 주소 */
const BACKEND = "http://localhost:8080/api/DiFF";

/** axios custom **/
export const NotionAPI = axios.create({
    baseURL: BACKEND,
    headers: { "Content-Type": "application/json" },
});

NotionAPI.interceptors.request.use(
    (config) => {
        if (typeof window !== "undefined") {
            const TOKEN_TYPE = localStorage.getItem("tokenType") || "Bearer";
            const ACCESS_TOKEN = localStorage.getItem("accessToken");

            if (ACCESS_TOKEN) {
                config.headers['Authorization'] = `${TOKEN_TYPE} ${ACCESS_TOKEN}`;
            }
            const REFRESH_TOKEN = localStorage.getItem("refreshToken");
            if (REFRESH_TOKEN) {
                config.headers['REFRESH_TOKEN'] = REFRESH_TOKEN;
            }
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

        if (ACCESS_TOKEN) {
            NotionAPI.defaults.headers['Authorization'] = `${TOKEN_TYPE} ${ACCESS_TOKEN}`;
        } else {
            delete NotionAPI.defaults.headers['Authorization'];
        }

        if (REFRESH_TOKEN) {
            NotionAPI.defaults.headers['REFRESH_TOKEN'] = REFRESH_TOKEN;
        } else {
            delete NotionAPI.defaults.headers['REFRESH_TOKEN'];
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
        NotionAPI.defaults.headers['Authorization'] = `${TOKEN_TYPE} ${ACCESS_TOKEN}`;
    }
};

/** 4. 인터셉터로 토큰 만료 자동 처리 */
NotionAPI.interceptors.response.use(
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
            return NotionAPI(originalRequest);
        }
        return Promise.reject(error);
    }
);

export const saveInquiry = async (inquiry) => {
    const response = await NotionAPI.post(
        '/notionInquiry/saveInquiry',
        inquiry
    );
    return response.data;
};

export const saveReport = async (report) => {
    const response = await NotionAPI.post(
        '/notionReport/saveReport',
        report
    );
    return response.data;
};
