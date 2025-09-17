// src/lib/bff.js
const BACKEND = "https://api.diff.io.kr/api/DiFF";

if (!BACKEND) {
    console.warn("⚠️ BACKEND 환경변수가 설정되지 않았습니다. 기본값을 사용하세요.");
}

// 브라우저에서 토큰 가져오기 (cookie > localStorage)
function getClientToken() {
    if (typeof document === 'undefined') return '';
    const m = document.cookie.match(/(?:^|;\s*)(Authorization|accessToken|jwt)=([^;]+)/i);
    let token = m ? decodeURIComponent(m[2]) : '';
    if (!token && typeof localStorage !== 'undefined') {
        token =
            localStorage.getItem('Authorization') ||
            localStorage.getItem('accessToken') ||
            localStorage.getItem('jwt') || '';
    }
    if (token && !/^Bearer\s/i.test(token)) token = `Bearer ${token}`;
    return token;
}

export async function bff(path, opts = {}) {
    // FE: /DiFF/...  →  BE: /api/DiFF/...
    const apiPath = path.replace(/^\/DiFF\//, '/api/DiFF/');

    // 서버/브라우저 공통 헤더 병합
    const h = new Headers(opts.headers);

    if (typeof window === 'undefined') {
        const { cookies, headers: nextHeaders } = await import('next/headers');
        const cookieStr = cookies().toString();
        if (cookieStr && !h.has('cookie')) h.set('cookie', cookieStr);

        const incomingAuth = nextHeaders().get('authorization');
        const cookieAuth =
            cookies().get('Authorization')?.value ||
            cookies().get('accessToken')?.value ||
            cookies().get('jwt')?.value || '';
        const bearer =
            h.get('authorization') ||
            incomingAuth ||
            (cookieAuth ? (cookieAuth.startsWith('Bearer ') ? cookieAuth : `Bearer ${cookieAuth}`) : '');

        if (bearer && !h.has('authorization')) h.set('authorization', bearer);

        return fetch(`${BACKEND}${apiPath}`, {
            ...opts,
            headers: h,
            cache: 'no-store',
            redirect: 'manual',     // ★ 302 자동 추적 금지
        });
    }

    const proxied = apiPath.replace(/^\/api\//, '/_bff/');

    // 브라우저 토큰 주입
    const clientBearer = h.get('authorization') || getClientToken();
    if (clientBearer && !h.has('authorization')) h.set('authorization', clientBearer);

    return fetch(proxied, {
        ...opts,
        headers: h,
        cache: 'no-store',
        credentials: 'include',
        redirect: 'manual',
    });
}
