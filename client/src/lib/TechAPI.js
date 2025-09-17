// 사용자의 선택 배지 목록을 저장/조회하는 API 호출들
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://13.124.33.233:8080';

function authHeaders() {
    const tokenType = (typeof window !== 'undefined' && localStorage.getItem('tokenType')) || 'Bearer';
    const access = typeof window !== 'undefined' && localStorage.getItem('accessToken');
    return access ? { 'Authorization': `${tokenType} ${access}` } : {};
}

// [내 것] 조회: GET /DiFF/member/tech  → ["java","react",...]
export async function getMyTechKeys() {
    const res = await fetch(`${BASE}/api/DiFF/member/tech`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
    });
    if (!res.ok) throw new Error('내 기술 목록 조회 실패');
    return res.json();
}

// [내 것] 저장: PUT /DiFF/member/tech  body: ["java","react"]
export async function saveMyTechKeys(keys) {
    const res = await fetch(`${BASE}/api/DiFF/member/tech`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify(keys),
    });
    if (!res.ok) throw new Error('내 기술 목록 저장 실패');
    return res.json();
}

// [공개 조회] 특정 닉네임의 선택 목록: GET /DiFF/member/{nick}/tech
export async function getTechKeysByNickName(nickName) {
    const res = await fetch(`${BASE}/api/DiFF/member/${encodeURIComponent(nickName)}/tech`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    });
    if (res.status === 404) return []; // 없으면 빈 배열
    if (!res.ok) throw new Error('사용자 기술 목록 조회 실패');
    return res.json();
}
