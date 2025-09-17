import {UserAPI} from "@/lib/UserAPI";
import {ArticleAPI} from "@/lib/ArticleAPI";

// fetch github repository
export const getGithubRepos = async () => {
    const response = await UserAPI.get(`/github/repos`, {});
    return response.data;
};

export const createRepository = async (data) => {


    try {
        const res = await ArticleAPI.post("/repository/createRepository", data);
        return res.data;
    } catch (err) {
        throw err;
    }
};

export const renameRepository = async (id, name) => {
    const payload = { id, name };

    try {
        const res = await ArticleAPI.post(
            "/repository/rename",
            payload,
            { headers: { "Content-Type": "application/json" } }
        );
        return res.data;
    } catch (err) {
        const msg = err?.response?.data ?? err.message;
        throw err;
    }
};


export const getAnalysisHistory = async (repoId) => {
    const res = await ArticleAPI.get(`/repository/${repoId}/history`);
    return res.data?.data1 || [];
};

export const getAnalysisRecent = async (repoId) => {
    const res = await ArticleAPI.get(`/repository/${repoId}/recent`);
    return res.data?.data1 || [];
};

export const getLanguageDistribution = async (repoId) => {
    try {
        const res = await ArticleAPI.get(`/repository/${repoId}/languages`);

        return res.data?.data1 ?? [];
    } catch (err) {
        throw err;
    }
};

export const importGithubRepo = async (ghRepo) => {
    const payload = {
        name: ghRepo?.name ?? ghRepo?.full_name ?? '',
        aPrivate: ghRepo?.aPrivate ?? !!ghRepo?.private ?? false,
        url: ghRepo?.url ?? ghRepo?.html_url ?? '',
        defaultBranch: ghRepo?.defaultBranch ?? ghRepo?.default_branch ?? '',
        githubOwner: ghRepo?.githubOwner ?? null,
        githubName: ghRepo?.githubName ?? null,
    };

    return await createRepository(payload);
};

export const getGithubCommitList = async (repo, opts = {}) => {

    if (!repo?.name || !repo?.url) {
        throw new Error('Missing repository');
    }

    // https://github.com/teamProject-Y/DiFF
    const owner = repo.githubOwner ?? repo.url.split('/')[3];
    const repoName = repo.githubName ?? repo.url.split('/')[4];

    const params = {
        owner: repo.owner ?? owner,
        repoName: repoName,
        branch: opts.branch ?? repo.defaultBranch ?? null,
        page: opts.page ?? null,
        perPage: opts.perPage ?? null,
    };

    const res = await UserAPI.get(`/github/commits`, {params});

    const data = res?.data ?? {};
    const code = data.resultCode || data.code || '';

    if (code && !String(code).startsWith('S-')) {
        return { resultCode: code, message: res.msg || '커밋 조회 실패', data: [] };
    }

    const raw =
        data.data1 ??
        (Array.isArray(data.data) ? data.data : data.data?.commits) ??
        [];

    const normalize = (c) => ({
        sha: c.sha,
        htmlUrl: c.htmlUrl || c.html_url,
        message: (c.message || '').split('\n')[0],
        authorName: c.authorName ?? c.AuthorName,
        authorLogin: c.authorLogin ?? c.AuthorLogin,
        authorAvatarUrl: c.authorAvatarUrl ?? c.AuthorAvatarUrl,
        authoredAt: c.authoredAt ?? c.AuthoredAt,
        parentSha:
            c.parentSha ??
            (Array.isArray(c.parents) && c.parents.length > 0 ? c.parents[0]?.sha : null),
    });

    return Array.isArray(raw) ? raw.map(normalize) : [];
};

export const connectRepository = async (repoId, url) => {
    // 1) validate
    const v = await ArticleAPI.get(`/github/validate`, { params: { url } });
    const code = String(v.data?.resultCode ?? v.data?.msg ?? "");
    if (code.startsWith("F-")) return v.data; // 실패면 그대로 반환

    // 2) validate 응답에서 owner/name/defaultBranch 꺼내기
    const owner         = v.data?.data?.owner         ?? v.data?.data1?.owner         ?? "";
    const name          = v.data?.data?.name          ?? v.data?.data1?.name          ?? "";
    const defaultBranch = v.data?.data?.defaultBranch ?? v.data?.data1?.defaultBranch ?? "";

    // 3) connect: POST + 쿼리 파라미터 (바디 없음이면 data 자리에 null)
    const { data } = await ArticleAPI.post(
        `/repository/connect`,
        null,
        {
            params: {
                repoId, // ← 서버 파라미터 이름과 동일!
                url,
                owner,
                name,
                defaultBranch,
            },
        }
    );

    return data;
};

export const mkDraft = async (repoId, owner, repoName, sha) => {

    if (!repoId || !owner || !repoName || !sha) {
        throw new Error(
            `mkDraft: missing required fields. repoId=${repoId} owner=${owner}, repoName=${repoName}, sha=${sha}`
        );
    }

    const res = await UserAPI.get(`/github/commit/${repoId}/${owner}/${repoName}/${sha}`,);
    return res.data;
};

export const deleteRepository = async (id) => {
    try {
        const res = await UserAPI.delete(`/repository/${id}`, {
            headers: {
                "Content-Type": "application/json",
            },
        });
        return res.data;
    } catch (error) {
        console.error("Error deleting repository:", error);
        return { resultCode: "F-ERROR", msg: error.message };
    }
};
