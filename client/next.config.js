// next.config.js
const BACKEND = "https://api.diff.io.kr";

// PWA 플러그인 로드
const withPWA = require("next-pwa")({
    dest: "public",
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === "development", // dev 모드에서는 비활성화
});

module.exports = withPWA({
    reactStrictMode: true,

    env: {
        NEXT_PUBLIC_API_BASE: BACKEND,
    },

    async redirects() {
        return [
            { source: "/", destination: "/DiFF/home/main", permanent: false },
            {
                source: "/login/github",
                destination: `${BACKEND}/oauth2/authorization/github`,
                permanent: false,
            },
            {
                source: "/login/google",
                destination: `${BACKEND}/oauth2/authorization/google`,
                permanent: false,
            },
            { source: "/home", destination: "/DiFF/home/main", permanent: false },
        ];
    },

    async rewrites() {
        return [
            { source: "/api/DiFF/:path*", destination: `${BACKEND}/api/DiFF/:path*` },
            { source: "/_bff/DiFF/:path*", destination: `${BACKEND}/api/DiFF/:path*` },
            {
                source: "/login/oauth2/code/:provider",
                destination: `${BACKEND}/login/oauth2/code/:provider`,
            },
            { source: "/resource/:path*", destination: "/resource/:path*" },
        ];
    },

    compiler: {
        styledComponents: true,
    },
});
