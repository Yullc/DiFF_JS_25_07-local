'use client';

import { motion } from 'framer-motion';
import {useEffect, useState, useRef, useMemo} from 'react';
import LanguageChart from "./languageChart";
import AnalysisHistoryChart from "./analysisHistoryChart.jsx";
import TotalAnalysisChart from "@/app/DiFF/member/repository/totalAnalysisChart";
import AnalysisRecentChart from "@/app/DiFF/member/repository/analysisRecentChart";
import {
    connectRepository,
    getAnalysisHistory,
    getAnalysisRecent,
    getLanguageDistribution,
    renameRepository,
    deleteRepository,
} from "@/lib/RepositoryAPI";
import CommitList from "@/app/DiFF/member/repository/commitList";

import { useDialog } from "@/common/commonLayout";

export function RepoInfo({
                             repo, isMyRepo, onClose, useExternalSidebar = false, onDeleted, onRenamed,
                         }) {
    const { alert, confirm } = useDialog();

    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(repo?.name ?? '');
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState("recent");
    const [repoUrl, setRepoUrl] = useState(repo?.url ?? '');
    const [displayName, setDisplayName] = useState(repo?.name ?? '');
    const [commitRefreshKey, setCommitRefreshKey] = useState(0);

    useEffect(() => setDisplayName(repo?.name ?? ''), [repo?.name]);
    useEffect(() => setRepoUrl(repo?.url ?? ''), [repo?.url]);

    useEffect(() => {
        if (repo?.id) getAnalysisHistory(repo.id).then(setHistory);
    }, [repo?.id]);

    useEffect(() => {
        setNameInput(repo?.name ?? '');
    }, [repo?.name]);

    const onSaveName = async () => {
        const next = nameInput.trim();
        if (!next || next === displayName) {
            setEditingName(false);
            setNameInput(displayName);
            return;
        }
        try {
            const res = await renameRepository(repo.id, next);
            if (res?.resultCode?.startsWith("S-")) {
                setDisplayName(next);
                setEditingName(false);
                setNameInput(next);
                onRenamed?.(repo.id, next);
                alert({intent: "success", title: "Repository name updated."});
            } else {
                alert({intent: "warning", title: res?.msg ?? "Couldn’t save changes."});
            }
        } catch (e) {
            console.error(e);
            alert({intent: "danger", title: "Something went wrong while saving."});
        }
    };

    // 깃허브 리포 연결
    async function connectionUrl(url) {
        try {
            const res = await connectRepository(repo.id, url);
            if (res?.resultCode === "S-1") {
                setRepoUrl(url);
                setCommitRefreshKey(k => k + 1);
                alert({intent: "success", title: "Repository connected."});
            } else {
                alert({intent: "warning", title: res?.msg ?? "Failed to connect repository."});
            }
        } catch (e) {
            console.error(e);
            alert({intent: "danger", title: "Connection error. Please try again."});
        }
    }

    // 언어 비율 데이터
    const [languages, setLanguages] = useState([]);
    useEffect(() => {
        if (!repo?.id) return;
        getLanguageDistribution(repo.id)
            .then(setLanguages)
            .catch((err) => console.error("[RepoInfo] API error =", err));
    }, [repo?.id]);

    const visibility = repo?.aprivate ? 'private' : 'public';

    const nameRef = useRef(null);
    const enterEdit = () => {
        setEditingName(true);
        setTimeout(() => nameRef.current?.focus?.(), 0);
    };
    const cancelEdit = () => {
        setEditingName(false);
        setNameInput(repo?.name ?? '');
    };
    const onKeyDownName = (e) => {
        if (e.key === 'Enter') onSaveName();
        if (e.key === 'Escape') cancelEdit();
    };

    const handleDelete = async () => {
        const ok = await confirm({
            intent: "danger",
            title: "Delete this repository?",
            message: "This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
        });
        if (!ok) return;

        try {
            const res = await deleteRepository(repo.id);
            if (res?.resultCode?.startsWith("S-")) {
                alert({
                    intent: "success",
                    title: "Repository deleted.",
                    onConfirm: () => {
                        onDeleted?.(repo.id); // 부모 목록 갱신 콜백 (부모에서 꼭 넘겨주세요)
                        onClose?.();          // 상세 닫기
                    },
                });
            } else {
                alert({intent: "warning", title: res?.msg ?? "Couldn’t delete repository."});
            }
        } catch (err) {
            console.error("Deletion failed: ", err);
            alert({intent: "danger", title: "Error while deleting. Please try again."});
        }
    };

    // 공통 복사 헬퍼
    const copyToClipboard = async (text, okMsg = "Copied!") => {
        try {
            await navigator.clipboard.writeText(text);
            alert?.({ intent: "success", title: okMsg });
        } catch (e) {
            console.error(e);
            alert?.({ intent: "warning", title: "Copy failed. Please try again." });
        }
    };

    // GitHub 링크/클론 문자열 파생
    const useGitHubLinks = (repoUrl) => {
        return useMemo(() => {
            try {
                const u = new URL(repoUrl);
                const [owner, repoName] = u.pathname.replace(/^\/|\/$/g, "").split("/");
                const base = `${u.origin}/${owner}/${repoName}`;
                return {
                    owner,
                    repoName,
                    base,
                    issues: `${base}/issues`,
                    pulls: `${base}/pulls`,
                    commits: `${base}/commits`,
                    branches: `${base}/branches`,
                    releases: `${base}/releases`,
                    insights: `${base}/pulse`,
                    contributors: `${base}/graphs/contributors`,
                    readme: `${base}#readme`,
                    desktop: `x-github-client://openRepo/${base}`,
                    vscode: `vscode://vscode.git/clone?url=${encodeURIComponent(base)}`,
                    httpsClone: `${base}.git`,
                    sshClone: `git@github.com:${owner}/${repoName}.git`,
                };
            } catch {
                return null;
            }
        }, [repoUrl]);
    };

    const gh = useGitHubLinks(repoUrl);

    return (
        <motion.div
            key={`detail-${repo?.id ?? 'none'}`}
            initial="hidden"
            animate="show"
            exit="hidden"
            className="absolute inset-0 p-4 overflow-y-auto"
        >
            {/* 왼쪽 레일 */}
            {!useExternalSidebar && (
                <aside className="border-r bg-gray-50 p-4 overflow-y-scroll">
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="w-full text-md text-gray-500 hover:text-gray-800"
                        >
                            <i className="fa-solid fa-angle-left"></i>
                        </button>
                    )}
                </aside>
            )}

            <div className="flex gap-3 h-full w-full overflow-y-scroll">
                <div className="max-w-[70%] min-w-[70%] flex flex-col">
                    <div className="flex-1 overflow-y-auto flex flex-col gap-3">

                        {/* 탭 내용 */}
                        <div className="h-[35%] relative rounded-xl border shadow-sm p-3
                            bg-white border-neutral-200 dark:bg-neutral-900/50 dark:border-neutral-700 pt-9">
                            <div
                                className="absolute top-4 right-5 z-30 flex items-center gap-2 pointer-events-none">
                                <button
                                    onClick={() => setActiveTab("recent")}
                                    className={`mx-1 text-sm flex items-center gap-1 pointer-events-auto
                                    ${activeTab === "recent" ? "text-blue-500" : "text-gray-400 dark:text-neutral-600"}`}
                                >
                                    <i className="fa-solid fa-circle text-[0.3rem]"></i>Recent
                                </button>
                                <button
                                    onClick={() => setActiveTab("history")}
                                    className={`mx-1 text-sm flex items-center gap-1 pointer-events-auto
                                    ${activeTab === "history" ? "text-blue-500" : "text-gray-400 dark:text-neutral-600"}`}
                                >
                                    <i className="fa-solid fa-circle text-[0.3rem]"></i>History
                                </button>
                                <button
                                    onClick={() => setActiveTab("total")}
                                    className={`mx-1 text-sm flex items-center gap-1 pointer-events-auto
                                    ${activeTab === "total" ? "text-blue-500" : "text-gray-400 dark:text-neutral-600"}`}
                                >
                                    <i className="fa-solid fa-circle text-[0.3rem]"></i>Total
                                </button>
                            </div>

                            {activeTab === "history" ? (
                                <AnalysisHistoryChart history={history} isMyRepo={isMyRepo} />
                            ) : activeTab === "total" ? (
                                <TotalAnalysisChart history={history} isMyRepo={isMyRepo} />
                            ) : (
                                <AnalysisRecentChart history={history} isMyRepo={isMyRepo} />
                            )}

                        </div>

                        {/* 하단 박스 */}
                        <div className="flex-grow overflow-y-scroll rounded-xl border shadow-sm
                            bg-white border-neutral-200 dark:bg-neutral-900/50 dark:border-neutral-700">

                            {isMyRepo ? (
                                // editor
                                repoUrl ? (
                                    <CommitList
                                        key={`commits-${repo?.id}-${repoUrl}-${commitRefreshKey}`}
                                        repo={{ ...repo, url: repoUrl }}
                                        refreshSignal={commitRefreshKey}
                                    />
                                ) : (
                                    <div className="relative h-full w-full flex flex-col items-center justify-center p-6 text-center">
                                        <div className="w-14 h-14 flex items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800 mb-3">
                                            <i className="fa-brands fa-github text-3xl text-gray-600 dark:text-neutral-400" />
                                        </div>

                                        <div className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
                                            Connect a GitHub repository
                                        </div>
                                        <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                                            Link your repo to enable analysis and commit history.
                                        </div>

                                        <form
                                            className="mt-4 w-full max-w-md flex items-center gap-2"
                                            onSubmit={async (e) => {
                                                e.preventDefault();
                                                const url = e.currentTarget.repoUrl.value.trim();
                                                await connectionUrl(url);
                                            }}
                                        >
                                            <div className="relative flex-1">
                                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                                                      <i className="fa-brands fa-github text-neutral-400" />
                                                    </span>
                                                <input
                                                    type="url"
                                                    name="repoUrl"
                                                    placeholder="https://github.com/owner/repo"
                                                    className="w-full pl-10 pr-3 py-2 rounded-lg bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
                                                    required
                                                    pattern="https?://(www\.)?github\.com/[^/\s]+/[^/\s]+/?"
                                                    aria-label="GitHub Repository URL"
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                className="px-3 py-2 rounded-lg bg-gray-100 dark:text-neutral-300 dark:bg-neutral-700 font-medium hover:opacity-60 transition"
                                            >
                                                Connect
                                            </button>
                                        </form>
                                    </div>
                                )
                            ) : (
                                // viewer
                                repoUrl ? (
                                    <div className="relative h-full w-full flex flex-col items-center justify-center p-6 text-center">
                                        <i className="fa-brands fa-github text-6xl text-gray-600 dark:text-neutral-400" />

                                        <div className="mt-5 text-lg font-semibold text-neutral-800 dark:text-neutral-200">
                                            This repository is managed by the owner.
                                        </div>
                                        <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
                                            You can jump to GitHub, open it directly in your tools, or copy a clone command.
                                        </div>

                                        {/* Primary CTAs */}
                                        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                                            <a
                                                href={repoUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-2 rounded-lg border  dark:border-neutral-600 dark:text-neutral-200 font-medium hover:opacity-80 transition"
                                                title="Open on GitHub"
                                                aria-label="Open on GitHub"
                                            >
                                                <i className="fa-brands fa-github mr-2" />
                                                Visit on GitHub
                                            </a>
                                        </div>

                                        {/* Quick links */}
                                        {gh && (
                                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-lg">
                                                <a href={gh.readme} target="_blank" rel="noopener noreferrer"
                                                   className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:opacity-80 transition text-sm">
                                                    <i className="fa-regular fa-file-lines mr-2" /> README
                                                </a>
                                                <a href={gh.commits} target="_blank" rel="noopener noreferrer"
                                                   className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:opacity-80 transition text-sm">
                                                    <i className="fa-solid fa-clock-rotate-left mr-2" /> Commits
                                                </a>
                                                <a href={gh.branches} target="_blank" rel="noopener noreferrer"
                                                   className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:opacity-80 transition text-sm">
                                                    <i className="fa-solid fa-code-branch mr-2" /> Branches
                                                </a>
                                            </div>
                                        )}
                                    </div> ) : (
                                    <div className="relative h-full w-full flex flex-col items-center justify-center p-6 text-center">
                                        <div className="w-14 h-14 flex items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800 mb-3">
                                            <i className="fa-solid fa-lock text-2xl text-gray-600 dark:text-neutral-400" />
                                        </div>
                                        <div className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
                                            The owner hasn’t linked a GitHub repo yet.
                                        </div>
                                        <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
                                            Once the owner connects a GitHub URL, you’ll be able to view the commit history here.
                                        </div>
                                    </div>
                                )
                            )}
                        </div>

                    </div>
                </div>

                <div className="w-[30%] grid grid-rows-[auto,1fr,auto] gap-3 h-full min-h-0">
                    {/* 상단 카드 */}
                    <div className="rounded-xl border shadow-sm p-4
                          bg-white border-neutral-200 dark:bg-neutral-900/50 dark:border-neutral-700">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center min-w-0 flex-grow h-11">
                                {editingName ? (
                                    <>
                                        <input
                                            ref={nameRef}
                                            value={nameInput}
                                            onChange={(e) => setNameInput(e.target.value)}
                                            onKeyDown={onKeyDownName}
                                            className="flex-grow min-w-0 px-1 py-2 mr-2 rounded-md border
                                 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                            placeholder="Repository name"
                                        />
                                        <button onClick={onSaveName} className="p-1" title="Save" aria-label="Save name">
                                            <i className="fa-solid fa-check"></i>
                                        </button>
                                        <button onClick={cancelEdit} title="Cancel" aria-label="Cancel edit">
                                            <i className="fa-solid fa-xmark"></i>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-xl font-semibold break-all pl-1">
                                            {displayName}
                                        </p>
                                        {isMyRepo &&
                                        <button
                                            onClick={enterEdit}
                                            className="pl-2 pb-1 text-xs text-neutral-300"
                                            title="Rename"
                                            aria-label="Rename repository"
                                        >
                                            <i className="fa-solid fa-pen"></i>
                                        </button>
                                        }
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="mt-2 flex w-full text-sm justify-between items-center">
                            <div className="">
                                <i className="fa-solid fa-calendar text-neutral-400"></i> {repo.regDate}
                            </div>
                            <span className="ml-auto text-xs px-2 py-1 rounded-full border
                                bg-white border-neutral-200 dark:bg-neutral-900/50 dark:border-neutral-700">
                                {visibility}
                            </span>
                            {repoUrl && (
                                <a
                                    href={repoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={repo?.name}
                                    className="shrink-0 text-gray-400 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors duration-100"
                                >
                                    &nbsp;&nbsp;&nbsp;<i className="fa-brands fa-github text-2xl "></i>
                                </a>
                            )}
                        </div>
                    </div>

                    {/* 언어 비율 */}
                    <div className="rounded-xl border shadow-sm p-4 pb-12
                          bg-white border-neutral-200 dark:bg-neutral-900/50 dark:border-neutral-700
                          flex flex-col min-h-0 overflow-hidden">
                        <div className="font-semibold">Languages</div>
                        <div className="mt-2 grow min-h-0">
                            <LanguageChart languages={languages} isMyRepo={isMyRepo}/>
                        </div>
                    </div>

                    {/* 삭제 버튼 */}
                    {isMyRepo &&
                    <button
                        onClick={handleDelete}
                        className="w-full p-2 border rounded-xl transition-colors
                       shadow-sm text-red-500 hover:bg-red-500 hover:text-white
                       bg-white border-neutral-200 dark:bg-neutral-900/50 dark:border-neutral-700"
                    >
                        Delete Repository
                    </button>
                    }
                </div>
            </div>
        </motion.div>
    );
}
