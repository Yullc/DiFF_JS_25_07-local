'use client';
import {getDraftById, saveDraft} from "@/lib/DraftAPI";
import {Suspense, useEffect, useState, useCallback, useMemo, useRef} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import {writeArticle, getMyRepositories} from '@/lib/ArticleAPI';
import dynamic from 'next/dynamic';
import clsx from "clsx";
import {useDialog} from "@/common/commonLayout";
import {useTheme} from "@/common/thema";

const ToastEditor = dynamic(() => import('@/common/toastEditor'), {ssr: false});

function RepoDropdown({items = [], value, onChange, disabled}) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef(null);
    const menuRef = useRef(null);

    const selected = useMemo(
        () => items.find((r) => Number(r.id) === Number(value)),
        [items, value]
    );

    const label = selected
        ? (selected.name || selected.repoName || `Repo#${selected.id}`)
        : "Select a repository";

    // close on outside click
    useEffect(() => {
        function onDocClick(e) {
            if (!open) return;
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target) &&
                btnRef.current &&
                !btnRef.current.contains(e.target)
            ) {
                setOpen(false);
            }
        }

        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    // keyboard
    const onKeyDown = useCallback(
        (e) => {
            if (disabled) return;
            if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                setOpen(true);
                return;
            }
            if (!open) return;

            const options = Array.from(menuRef.current?.querySelectorAll("[role='option']") || []);
            const currentIndex = options.findIndex((el) => el === document.activeElement);
            if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                btnRef.current?.focus();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                const next = options[Math.min(currentIndex + 1, options.length - 1)] || options[0];
                next?.focus();
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const prev = options[Math.max(currentIndex - 1, 0)] || options[options.length - 1];
                prev?.focus();
            } else if (e.key === "Enter") {
                e.preventDefault();
                const id = document.activeElement?.getAttribute("data-value");
                if (id != null) {
                    onChange?.(Number(id));
                    setOpen(false);
                    btnRef.current?.focus();
                }
            }
        },
        [open, onChange, disabled]
    );

    return (
        <div className="relative" onKeyDown={onKeyDown}>
            <button
                type="button"
                ref={btnRef}
                onClick={() => !disabled && setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                disabled={disabled}
                className={clsx(
                    "h-9 min-w-[12rem] truncate rounded-md border px-3 text-left text-sm",
                    "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50",
                    "outline-none focus:border-neutral-600",
                    "dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-950/60",
                    disabled && "opacity-60 cursor-not-allowed"
                )}
            >
                {label}
                <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 dark:text-neutral-500"/>
            </button>

            {open && (
                <ul
                    ref={menuRef}
                    role="listbox"
                    className={clsx(
                        "absolute left-0 top-full z-50 mt-1 w-[24rem] max-w-[70vw] overflow-auto rounded-md border shadow-lg",
                        "max-h-64 border-neutral-200 bg-white/95 backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/95"
                    )}
                >
                    {items.map((r) => {
                        const id = String(r.id);
                        const text = r.name || r.repoName || `Repo#${r.id}`;
                        const isSelected = String(value) === id;
                        return (
                            <li
                                key={id}
                                role="option"
                                aria-selected={isSelected}
                                tabIndex={0}
                                data-value={id}
                                onClick={() => {
                                    onChange?.(Number(id));
                                    setOpen(false);
                                    btnRef.current?.focus();
                                }}
                                className={clsx(
                                    "flex cursor-pointer items-center justify-between px-3 py-2 text-sm",
                                    "text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800",
                                    isSelected && "bg-neutral-200/70 dark:bg-neutral-700/60"
                                )}
                            >
                                <span className="truncate">{text}</span>
                                {isSelected && <i className="fa-solid fa-check text-xs opacity-70"/>}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<div className="p-4 text-sm">Loading…</div>}>
            <WriteArticlePage/>
        </Suspense>
    );
}

export function WriteArticlePage() {
    const router = useRouter();
    const { alert } = useDialog();
    const sp = useSearchParams();

    // from query
    const repoFromQuery = sp.get('repositoryId');

    // state
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [repos, setRepos] = useState([]);
    const [repositoryId, setRepositoryId] = useState(null);
    const [loadingRepos, setLoadingRepos] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submittingType, setSubmittingType] = useState(null);
    const [error, setError] = useState('');
    const [repoError, setRepoError] = useState('');
    const [draftId, setDraftId] = useState(sp.get('draftId'));
    const [diffId, setDiffId] = useState(null);
    const [isPublic, setIsPublic] = useState(true);

    const bg = useTheme() === 'dark' ? '#111214' : '#ffffff';

    // auth check
    useEffect(() => {
        const token = typeof window !== 'undefined' && localStorage.getItem('accessToken');
        if (!token) router.replace('/DiFF/member/login');
    }, [router]);

    // load draft if present
    useEffect(() => {
        if (draftId) {
            (async () => {
                try {
                    const draft = await getDraftById(draftId);
                    setIsPublic(draft.isPublic ?? true);
                    setTitle(draft.title || '');
                    setBody(draft.body || '');
                    setRepositoryId(draft.repositoryId || null);
                    if (draft.diffId) {
                        setDiffId(draft.diffId);
                    }
                } catch (e) {
                    console.error('Failed to load draft:', e);
                }
            })();
        }
    }, [draftId]);

    // load repos
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoadingRepos(true);
                setRepoError('');
                const list = await getMyRepositories();
                if (!mounted) return;
                setRepos(list);
                const init =
                    (repoFromQuery && Number(repoFromQuery)) ||
                    (list.length > 0 ? Number(list[0].id) : null);
                setRepositoryId(init);
            } catch (e) {
                setRepoError('Failed to load repository list.');
            } finally {
                setLoadingRepos(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [repoFromQuery]);

    async function makeChecksum(text) {
        if (!text) return "";

        if (typeof window === "undefined" || !window.crypto?.subtle) {
            console.warn("❌ crypto.subtle 미지원");
            return "";
        }

        const enc = new TextEncoder().encode(text);
        const buf = await crypto.subtle.digest("SHA-256", enc);
        return Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }

    // submit (upload)
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!repositoryId) return setError('Not found repository.');
        if (!title.trim()) return setError('Please enter the title.');
        if (!body.trim()) return setError('Please enter the content.');

        try {
            setSubmitting(true);
            setSubmittingType('upload');
            const checksum = await makeChecksum(body);
            const data = {
                title,
                body,
                checksum,
                repositoryId: Number(repositoryId),
                draftId: draftId ? Number(draftId) : null,
                diffId: diffId ? Number(diffId) : null,
                isPublic: isPublic,
            };
            const res = await writeArticle(data);
            if (res?.resultCode?.startsWith('S-')) {
                const articleId = res.data1;
                // router.push(`/DiFF/article/detail?id=${articleId}`);
                setTimeout(() => router.push(`/DiFF/article/detail?id=${articleId}`), 0);
            } else {
                setError(res?.msg || 'Failed to write');
            }
        } catch (err) {
            console.error('upload error', err);
            if (err?.response?.status === 401) {
                router.replace('/DiFF/member/login');
            } else {
                setError(err?.response?.data?.msg || err.message || 'Failed to request');
            }
        } finally {
            setSubmitting(false);
            setSubmittingType(null);
        }
    };

    // save draft
    const handleSaveDraft = async (e) => {
        e?.preventDefault?.();
        setError('');

        if (!repositoryId) return setError('Can\'t find repository.');
        if (!title.trim() && !body.trim()) return setError('Can\'t save empty post');

        try {
            setSubmitting(true);
            setSubmittingType('save');
            const checksum = await makeChecksum(body);
            const data = {
                id: draftId ? Number(draftId) : null,
                title,
                body,
                checksum,
                repositoryId: Number(repositoryId),
                isPublic: isPublic,
            };
            const res = await saveDraft(data);
            if (res && res.resultCode && res.resultCode.startsWith('S-')) {
                alert({ intent: "success", title: "Success to save." });
                if (!draftId && res.data1) setDraftId(res.data1);
                if (res.data2) setDiffId(res.data2);
            } else {
                setError(res?.msg || 'Failed to save');
            }
        } catch (err) {
            console.error('saveDraft error', err);
            if (err?.response?.status === 401) {
                router.replace('/DiFF/member/login');
            } else {
                setError(err?.response?.data?.msg || err.message || 'Failed to reqeust');
            }
        } finally {
            setSubmitting(false);
            setSubmittingType(null);
        }
    };

    // shortcuts: Ctrl/Cmd+S save, Ctrl/Cmd+Enter upload
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (!submitting) handleSaveDraft(e);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (!submitting) {
                    const form = document.getElementById('writer-form');
                    form?.dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}));
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [submitting, handleSaveDraft]);

    return (
        <div
            className={clsx(
                "fixed inset-0 flex flex-col",
                "bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-300"
            )}
        >
            <form
                id="writer-form"
                onSubmit={handleSubmit}
                className="flex-1 flex flex-col min-h-0"
                aria-live="polite"
            >
                <div
                    className={clsx(
                        "sticky inset-x-0 top-0 z-40 border-b p-3",
                        "border-neutral-200 dark:border-neutral-700",
                        "bg-white dark:bg-neutral-900"
                    )}
                >
                    {/* Title */}
                    <div className="flex-1">
                        <input
                            className={clsx(
                                "w-full truncate rounded p-3 text-5xl font-semibold",
                                "bg-transparent border-transparent focus:outline-none",
                                "placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                            )}
                            placeholder="Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-between items-center">
                        {/* Repo */}
                        <div className="col-span-12 sm:col-span-4 md:col-span-3 flex items-center gap-2">
                            {loadingRepos ? (
                                <div className="h-9 w-48 animate-pulse rounded-md bg-neutral-200/70 dark:bg-neutral-800/70" />
                            ) : repoError ? (
                                <div className="truncate text-xs text-red-500">{repoError}</div>
                            ) : repos.length === 0 ? (
                                <div className="truncate text-xs text-yellow-700 dark:text-yellow-300">
                                    No repositories. Create one first.
                                </div>
                            ) : (
                                <RepoDropdown
                                    items={repos}
                                    value={repositoryId}
                                    onChange={(v) => setRepositoryId(Number(v))}
                                />
                            )}
                        </div>

                        {/* Actions */}
                        <div className="col-span-12 sm:col-span-3 md:col-span-3 flex items-center justify-end gap-2">
                            {/* Visibility toggle */}
                            <button
                                type="button"
                                onClick={() => setIsPublic(!isPublic)}
                                className={clsx(
                                    "relative inline-flex h-6 w-11 items-center rounded-full transition",
                                    isPublic
                                        ? "bg-neutral-900 dark:bg-neutral-100"
                                        : "bg-neutral-300 dark:bg-neutral-700"
                                )}
                                aria-label={isPublic ? "Public" : "Private"}
                                title={isPublic ? "Public" : "Private"}
                            >
                                <span
                                    className={clsx(
                                        "inline-block h-4 w-4 transform rounded-full bg-white transition",
                                        isPublic ? "translate-x-6" : "translate-x-1"
                                    )}
                                />
                                            </button>
                                            <span className="hidden md:inline text-xs text-neutral-500">
                                    {isPublic ? "Public" : "Private"}
                                </span>

                            <button
                                type="button"
                                onClick={() => router.push("/DiFF/article/drafts")}
                                className={clsx(
                                    "h-9 rounded-md px-3 text-sm text-neutral-600 hover:text-neutral-900 hover:underline",
                                    "dark:text-neutral-400 dark:hover:text-neutral-100"
                                )}
                            >
                                Drafts
                            </button>
                        </div>
                    </div>
                </div>

                {!!error && (
                    <div className="border-b border-red-200/60 bg-red-50/70 px-3 py-1.5 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                    </div>
                )}

                <div className="flex-1 overflow-hidden">
                    <div className="h-full w-full">
                        <ToastEditor
                            initialValue={body}
                            onChange={(value) => setBody(value)}
                            height="100%"
                        />
                    </div>
                </div>

                <div className="sticky bottom-0 z-50 w-full border-t p-3 bg-white dark:bg-neutral-900 dark:border-neutral-700">
                    <div className="flex justify-end gap-5">
                        <button
                            type="button"
                            onClick={handleSaveDraft}
                            disabled={submitting || !repositoryId}
                            className={clsx(
                                "rounded-md border px-5 py-2 font-medium",
                                "border-neutral-300 bg-transparent text-neutral-800 hover:bg-neutral-100/60",
                                "disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                            )}
                        >
                            {submitting && submittingType === "save" ? "Saving…" : "Save"}
                        </button>

                        <button
                            type="submit"
                            disabled={submitting || !repositoryId}
                            className={clsx(
                                "rounded-md border px-5 py-2 font-medium",
                                "bg-gray-900 text-white hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]",
                                "disabled:opacity-50 dark:border-neutral-300 dark:bg-neutral-300 dark:text-neutral-900"
                            )}
                        >
                            {submitting && submittingType === "upload" ? "Uploading…" : "Upload"}
                        </button>
                    </div>
                </div>
            </form>

            <style jsx global>{`
                /* ---- Frame: editor full height + sticky toolbar ---- */
                .toastui-editor-defaultUI {
                    height: 100% !important;
                    display: flex;
                    flex-direction: column;
                    border: 0 !important;
                }
                .toastui-editor-toolbar {
                    position: sticky;
                    top: 0;
                    z-index: 30;
                    flex: 0 0 auto;
                    background: inherit;
                }

                /* ---- Main takes the scroll (ONLY here) ---- */
                .toastui-editor-main {
                    flex: 1 1 auto !important;
                    min-height: 0 !important;
                    overflow: auto !important;   /* ← 여기만 스크롤 */
                }

                /* 메인 내부 컨테이너/패널이 메인 높이를 정확히 채우도록 */
                .toastui-editor-main-container {
                    display: flex !important;
                    height: 100% !important;
                    min-height: 0 !important;
                }
                .toastui-editor-md-container.toastui-editor-md-vertical-style,
                .toastui-editor-preview.toastui-editor-vertical-style {
                    flex: 1 1 0% !important;
                    height: 100% !important;
                    min-height: 0 !important;
                }

                /* ---- Markdown pane: CodeMirror는 'auto-height', 내부 스크롤 제거 ---- */
                .toastui-editor-md-container .CodeMirror {
                    height: auto !important;              /* 내용 길이에 맞춰 늘어남 */
                }
                .toastui-editor-md-container .CodeMirror-scroll {
                    overflow-y: hidden !important;        /* 내부 스크롤 금지 (수직) */
                    overflow-x: auto !important;          /* 수평 스크롤만 허용 */
                    min-height: 100% !important;          /* 클릭 영역이 패널 높이만큼 확보 */
                }

                /* ---- WYSIWYG pane도 내부 스크롤 제거 ---- */
                .toastui-editor-ww-container .ProseMirror {
                    height: auto !important;
                    min-height: 100% !important;
                    overflow: visible !important;
                }

                /* 탭(Write/Preview) 숨김 */
                .toastui-editor-defaultUI .toastui-editor-tabs {
                    display: none !important;
                }
            `}</style>
        </div>
    );
}
