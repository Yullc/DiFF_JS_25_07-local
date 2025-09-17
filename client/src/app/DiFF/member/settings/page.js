'use client';

import {useEffect, useMemo, useRef, useState, Suspense} from 'react';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {fetchUser, uploadProfileImg, modifyNickName, modifyIntroduce, deleteUser} from "@/lib/UserAPI";
import {updateNotificationSetting} from "@/lib/NotificationAPI";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {Prism as SyntaxHighlighter} from "react-syntax-highlighter";
import {oneDark} from "react-syntax-highlighter/dist/esm/styles/prism";
import {oneLight} from "react-syntax-highlighter/dist/esm/styles/prism";
import {useDialog} from "@/common/commonLayout";
import {useTheme} from "@/common/thema";

export default function SettingsTab() {
    return (
        <Suspense fallback={<div className="p-8 text-sm">Loading...</div>}>
            <SettingsPage/>
        </Suspense>
    );
}

function SettingsPage() {
    const router = useRouter();
    const {alert, confirm} = useDialog();
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [member, setMember] = useState(null);
    const [isMySetting, setIsMySetting] = useState(false);
    const [profileUrl, setProfileUrl] = useState('');
    const [linked, setLinked] = useState({google: false, github: false});
    const [form, setForm] = useState({nickName: '', introduce: ''});

    const [activeMdTab, setActiveMdTab] = useState('write');

    const [removing, setRemoving] = useState(false);

    const fileInputRef = useRef(null);
    const [editingNick, setEditingNick] = useState(false);
    const nickRef = useRef(null);

    const [settings, setSettings] = useState({
        reply: member?.allowReplyNotification ?? false,
        follow: member?.allowFollowNotification ?? false,
        article: member?.allowArticleNotification ?? false,
        draft: member?.allowDraftNotification ?? false,
    });

    //  알림 아이템
    const items = [
        {
            key: "reply",
            title: "Comment",
            desc: "When someone comments on your post.",
        },
        {
            key: "follow",
            title: "Follow",
            desc: "When someone follows you.",
        },
        {
            key: "article",
            title: "New Article",
            desc: "When someone you follow publishes a new article.",
        },
        {
            key: "draft",
            title: "Draft",
            desc: "When your post is saved as a draft.",
        },
    ];

    const theme = useTheme();
    const syntaxStyle = useMemo(() => (String(theme).toLowerCase() === "dark" ? oneDark : oneLight), [theme]);

    function normalizeLanguage(lang) {
        if (!lang) return "text";
        const m = lang.toLowerCase();
        if (m === "js" || m === "jsx") return "javascript";
        if (m === "ts" || m === "tsx") return "typescript";
        if (m === "sh" || m === "zsh") return "bash";
        if (m === "c++") return "cpp";
        return m;
    }

    const handleToggle = async (type) => {
        const newValue = !settings[type];
        setSettings((prev) => ({...prev, [type]: newValue}));

        try {
            await updateNotificationSetting(type, newValue);
        } catch (err) {
            setSettings((prev) => ({...prev, [type]: !newValue}));
        }
    };

    // 소셜 로그인 연동
    const startLink = (provider) => {
        if (provider !== 'google' && provider !== 'github') return;
        const url = `/api/DiFF/auth/link/${provider}?mode=link`;
        window.location.href = url;
    };

    const onClickRemove = async () => {
        const ok = await confirm({
            intent: "danger",
            title: "Are you sure you want to delete your account?",
            message: "This action cannot be undone.",
            confirmText: "Delete account",
            cancelText: "Cancel",
        });
        if (!ok) return;

        try {
            const res = await deleteUser(member.id);
            if (res?.resultCode?.startsWith("S-")) {
                alert({intent: "neutral", title: "Goodbye, see you next time."});
                router.push("/DiFF/member/logout")
            } else {
                alert({intent: "warning", title: res?.msg ?? "Server error. Please try again later."});
            }
        } catch (err) {
            console.error("Deletion failed: ", err);
            alert({intent: "danger", title: "Server error. Please try again later."});
        }
    };

    useEffect(() => {
        const accessToken = typeof window !== 'undefined' && localStorage.getItem('accessToken');
        const myNickName = typeof window !== 'undefined' && localStorage.getItem('nickName');

        if (!accessToken) {
            router.replace('/DiFF/home/main');
            return;
        }

        const nickName = searchParams.get("nickName");

        fetchUser(nickName)
            .then((res) => {
                const fetchedMember = res.member;
                setMember(fetchedMember);
                setProfileUrl(fetchedMember?.profileUrl || "");
                setForm({
                    nickName: fetchedMember?.nickName || "",
                    introduce: fetchedMember?.introduce || "",
                });
                setSettings({
                    reply: fetchedMember.allowReplyNotification,
                    follow: fetchedMember.allowFollowNotification,
                    article: fetchedMember.allowArticleNotification,
                    draft: fetchedMember.allowDraftNotification,
                });
                setLoading(false);

                setIsMySetting(!nickName || nickName === myNickName);
            })
            .catch(err => {
                console.error("마이페이지 오류:", err);
                setLoading(false);
                router.replace('/DiFF/home/main');
            });

        const base = "https:api.diff.io.kr";

        fetch(`${base}/api/DiFF/auth/linked`, {
            headers: {Authorization: `Bearer ${accessToken}`},
            credentials: 'include',
        })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(data => setLinked({google: !!data.google, github: !!data.github}))
            .catch(() => {
            });
    }, [router, searchParams]);

    const handleChange = (e) => setForm({...form, [e.target.name]: e.target.value});

    const handleRemoveAvatar = async () => {
        if (!isMySetting || !profileUrl) return;

        const ok = await confirm({
            intent: 'Info',
            title: 'Do you want to delete your profile picture?',
            confirmText: 'Delete',
            cancelText: 'Cancel',
        });
        if (!ok) return;

        setRemoving(true);
        try {
            await uploadProfileImg(null);
            setProfileUrl('');
            setMember(prev => ({...prev, profileUrl: ''}));

        } catch (e) {
            await alert({
                intent: 'danger',
                title: 'Failed to delete.',
                message: e?.response?.data?.msg || e.message || '',
            });
        } finally {
            setRemoving(false);
        }
    };

    const dirtyNick = useMemo(
        () => form.nickName !== (member?.nickName || ''),
        [form.nickName, member?.nickName]
    );

    const dirtyIntro = useMemo(
        () => form.introduce !== (member?.introduce || ''),
        [form.introduce, member?.introduce]
    );

    // introduce 수정 (README 형식)
    const handleSubmitIntroduce = async (e) => {
        e.preventDefault();
        if (!dirtyIntro) return;

        try {
            const res = await modifyIntroduce({introduce: form.introduce});
            setMember((prev) => ({...prev, introduce: form.introduce}));
        } catch (err) {
            console.error("introduce 수정 실패:", err);
        }
    };

    // README 저장 단축키: ⌘/Ctrl + Enter
    useEffect(() => {
        const handler = (e) => {
            const cmd = e.metaKey || e.ctrlKey;
            if (cmd && e.key === 'Enter') {
                const formEl = document.getElementById('introduceForm');
                if (formEl) {
                    e.preventDefault();
                    formEl.requestSubmit();
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const handleInput = (e) => {
        const textarea = e.target;
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
    };


    if (loading) return <PageSkeleton/>;

    // 닉네임 저장
    const onSaveNick = async () => {
        if (!dirtyNick) {
            setEditingNick(false);
            return;
        }
        try {
            const res = await modifyNickName({ nickName: form.nickName });

            if (res && res.resultCode) {
                if (res.resultCode === "S-1") {
                    setMember((prev) => ({ ...prev, nickName: form.nickName }));
                    setEditingNick(false);
                } else if (res.resultCode === "F-8") {
                    alert({ intent: "danger", title: res.msg || "This nickname is already in use." });
                } else if (res.resultCode === "F-7") {
                    alert({ intent: "danger", title: res.msg || "Failed to edit member information" });
                } else {
                    alert({ intent: "danger", title: res.msg || "Unknown error" });
                }
            } else {
                alert({ intent: "danger", title: "Invalid server response" });
            }
        } catch (err) {
            console.error("닉네임 수정 에러:", err);
            alert({ intent: "danger", title: err?.response?.data?.msg || "Server error" });
        }
    };
// 닉네임 편집 취소
    const cancelEditNick = () => {
        setForm((prev) => ({...prev, nickName: member?.nickName || ""}));
        setEditingNick(false);
    };

    return (
        <div className="w-full h-[calc(100vh-theme(spacing.20))] overflow-hidden mx-4 dark:text-neutral-300">
            {/*<div className="h-full">*/}
            <div className="mx-auto flex h-full">
                <main className="flex-1 flex flex-col min-h-0 max-w-6xl">
                    <div className="bg-white dark:bg-neutral-900 flex items-center text-neutral-500">
                        <TopTab href="/DiFF/member/profile" label="Profile"/>
                        <TopTab href="/DiFF/member/repository" label="Repositories"/>
                        <TopTab active href="#" label="Settings"/>
                    </div>

                    <div className="flex-1 min-h-0 pt-10">
                        <div className="mx-auto max-w-6xl pb-16">

                            {/* 메인 2컬럼 */}
                            <div className="flex gap-6 px-2">

                                {/* LEFT : 아바타/닉네임/테마/연동 */}
                                <div className="flex flex-col gap-4">

                                    {/* 아바타 카드 */}
                                    <Card>
                                        <div className="flex items-start gap-4">
                                            <div
                                                className="relative h-28 w-28 overflow-hidden rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900">
                                                {profileUrl ? (
                                                    <img src={profileUrl} alt="avatar"
                                                         className="h-full w-full object-cover"/>
                                                ) : (
                                                    <div
                                                        className="flex h-full w-full items-center justify-center text-6xl text-neutral-400">
                                                        <i className="fa-solid fa-skull"></i>
                                                    </div>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-neutral-900/70 py-1 text-[12px] text-neutral-200 backdrop-blur"
                                                >
                                                    <i className="fa-regular fa-camera"></i>
                                                    <span>Edit</span>
                                                </button>

                                                <input
                                                    ref={fileInputRef}
                                                    id="profileUpload"
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        try {
                                                            const url = await uploadProfileImg(file);
                                                            setProfileUrl(url);
                                                        } catch (err) {
                                                            console.error('업로드 실패:', err);
                                                        }
                                                    }}
                                                />
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center min-w-0 flex-grow h-11">
                                                        {editingNick ? (
                                                            <>
                                                                <input
                                                                    ref={nickRef}
                                                                    value={form.nickName}
                                                                    onChange={(e) => setForm({
                                                                        ...form,
                                                                        nickName: e.target.value
                                                                    })}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") onSaveNick();
                                                                        if (e.key === "Escape") cancelEditNick();
                                                                    }}
                                                                    className="flex-grow min-w-0 w-[80%] px-2 py-1 mr-2 rounded-md border text-xl font-semibold
                                                                        focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                                    placeholder="nickname"
                                                                />
                                                                <button
                                                                    onClick={onSaveNick}
                                                                    className="p-1"
                                                                    title="Save"
                                                                    aria-label="Save nickname"
                                                                >
                                                                    <i className="fa-solid fa-check"></i>
                                                                </button>
                                                                <button
                                                                    onClick={cancelEditNick}
                                                                    className="p-1"
                                                                    title="Cancel"
                                                                    aria-label="Cancel edit"
                                                                >
                                                                    <i className="fa-solid fa-xmark"></i>
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="break-all pr-2 text-3xl font-bold">
                                                                    {member?.nickName ?? "nickname"}
                                                                </p>
                                                                <button
                                                                    onClick={() => setEditingNick(true)}
                                                                    className="pb-1 text-base text-neutral-400"
                                                                    title="Rename"
                                                                    aria-label="Rename nickname"
                                                                >
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div
                                                    className="my-1 text-base text-neutral-500 dark:text-neutral-500">
                                                    {member?.email || '-'}
                                                </div>

                                                {/* 소셜 연동 */}
                                                <div className="flex items-center gap-2">
                                                    <LinkBtn
                                                        brand="google"
                                                        label={linked.google ? "Connected" : "Connect"}
                                                        onClick={() => !linked.google && startLink("google")}
                                                        disabled={linked.google}
                                                    />

                                                    <LinkBtn
                                                        brand="github"
                                                        label={linked.github ? "Connected" : "Connect"}
                                                        onClick={() => !linked.github && startLink("github")}
                                                        disabled={linked.github}
                                                    />

                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    <Card className="p-4 space-y-4">
                                        <h2 className="text-lg font-semibold mb-2 pt-3">Notification Settings</h2>

                                        <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                                            {items.map((item) => {
                                                const isOn = settings[item.key];
                                                return (
                                                    <div
                                                        key={item.key}
                                                        className="flex items-center justify-between py-3"
                                                    >
                                                        <div className="pr-2">
                                                            <div
                                                                className="mb-1 text-base font-medium">{item.title}</div>
                                                            <p className="text-sm text-neutral-500">{item.desc}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggle(item.key)}
                                                            className={`w-16 rounded px-3 py-1.5 text-sm font-medium transition-colors
                                                          border
                                                          ${isOn
                                                                ? "border-gray-700 text-gray-700 dark:text-neutral-400 dark:border-neutral-400 " +
                                                                "dark:bg-neutral-900 hover:bg-gray-100 dark:hover:neutral-800"
                                                                : "border-red-500 text-red-500 hover:bg-red-500/10"
                                                            }`}
                                                        >
                                                            {isOn ? "ON" : "OFF"}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </Card>


                                    <Card>
                                        <div className="flex items-center justify-between">
                                            <div className="pr-2">
                                                <div className="mb-1 text-lg font-semibold">Delete account</div>
                                                <p className="text-sm text-neutral-500">Your account and data will
                                                    be
                                                    permanently
                                                    deleted.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={onClickRemove}
                                                className="rounded px-3 py-1.5 text-sm self-end border
                                    border-gray-300 hover:border-red-500 hover:text-red-500
                                    dark:border-gray-400 dark:hover:border-red-500"
                                            >
                                                Delete account
                                            </button>
                                        </div>

                                    </Card>
                                </div>

                                <div className="flex-grow flex flex-col gap-4">

                                    {/* Profile README */}
                                    <Card className="flex-1 flex flex-col">
                                        <div className="mb-3 flex items-center justify-between">
                                            <h3 className="text-2xl font-bold">Profile README</h3>

                                            {/* Write / Preview 탭 */}
                                            <div
                                                className="flex items-center rounded-lg border border-neutral-300 dark:border-neutral-700 overflow-hidden">
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveMdTab("write")}
                                                    className={
                                                        "px-3 py-1 text-sm " +
                                                        (activeMdTab === "write"
                                                            ? "bg-neutral-800 text-neutral-100"
                                                            : "text-neutral-500 dark:text-neutral-300")
                                                    }
                                                >
                                                    Write
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveMdTab("preview")}
                                                    className={
                                                        "px-3 py-1 text-sm " +
                                                        (activeMdTab === "preview"
                                                            ? "bg-neutral-800 text-neutral-100"
                                                            : "text-neutral-500 dark:text-neutral-300")
                                                    }
                                                >
                                                    Preview
                                                </button>
                                            </div>
                                        </div>

                                        <form id="introduceForm" onSubmit={handleSubmitIntroduce}
                                              className="flex flex-col gap-3 h-full">
                                            {activeMdTab === "write" ? (
                                                <textarea
                                                    name="introduce"
                                                    value={form.introduce ?? ""}
                                                    onChange={handleChange}
                                                    onInput={handleInput}
                                                    className="flex-1 rounded-md border border-neutral-300 bg-white p-4 text-neutral-800 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"

                                                    placeholder={`마크다운 형식으로 자기소개 작성\n예) ![Java](https://img.shields.io/badge/Java-ED8B00?logo=openjdk&logoColor=white)\n\n저는 Spring Boot와 React를 좋아합니다!`}
                                                />
                                            ) : (
                                                <div
                                                    className="markdown flex-1 rounded-md border border-neutral-300 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/60">
                                                    <ReactMarkdown
                                                        key={String(theme)}
                                                        remarkPlugins={[remarkGfm]}
                                                        rehypePlugins={[rehypeRaw]}
                                                        components={{
                                                            code({node, inline, className, children, ...props}) {
                                                                const match = /language-(\w+)/.exec(className || "");
                                                                const lang = match ? normalizeLanguage(match[1]) : undefined;
                                                                return !inline && lang ? (
                                                                    <SyntaxHighlighter
                                                                        style={syntaxStyle}
                                                                        language={match[1]}
                                                                        PreTag="div"
                                                                        wrapLongLines
                                                                        {...props}
                                                                    >
                                                                        {String(children).replace(/\n$/, "")}
                                                                    </SyntaxHighlighter>
                                                                ) : (
                                                                    <code className={className} {...props}>
                                                                        {children}
                                                                    </code>
                                                                );
                                                            },
                                                            ul: ({node, ...props}) => (
                                                                <ul className="list-disc pl-6" {...props} />
                                                            ),
                                                            ol: ({node, ...props}) => (
                                                                <ol className="list-decimal pl-6" {...props} />
                                                            ),
                                                        }}
                                                    >
                                                        {form.introduce ?? ""}
                                                    </ReactMarkdown>
                                                </div>
                                            )}

                                            {/* 하단 Save 버튼 */}
                                            <div className="flex items-center justify-end text-xs text-neutral-500">
                                                <button
                                                    type="submit"
                                                    disabled={!dirtyIntro}
                                                    className={
                                                        "rounded bg-neutral-900 px-4 py-2 text-white " +
                                                        (!dirtyIntro ? "opacity-50 cursor-not-allowed" : "hover:bg-neutral-800")
                                                    }
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        </form>
                                    </Card>


                                    {/* 회원탈퇴 */}
                                    <Card>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
            {/*</div>*/}
        </div>
    );
}

function Card({children, className}) {
    return (
        <div className={className}>
            {children}
        </div>
    );
}

function TopTab({href, label, active}) {
    return active ? (
        <span
            className="p-4 -mb-px font-semibold text-black dark:text-neutral-300 border-b-2 border-black dark:border-neutral-300">
      {label}
    </span>
    ) : (
        <Link href={href} className="p-4 -mb-px hover:text-neutral-700 dark:hover:text-neutral-300">
            {label}
        </Link>
    );
}

function LinkBtn({label, onClick, disabled, brand}) {
    const base =
        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition " +
        "border focus-visible:outline-none focus-visible:ring-2 " +
        "focus-visible:ring-neutral-400/60 focus-visible:ring-offset-2 " +
        "focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950 " +
        "border-neutral-300 dark:border-neutral-700";

    const enabled =
        "bg-neutral-100 shadow-sm hover:bg-neutral-300 active:bg-neutral-800 " +
        "dark:bg-neutral-900 dark:text-white dark:hover:neutral-800";

    const blocked =
        "bg-neutral-100 text-neutral-400 border-neutral-200 " +
        "dark:bg-neutral-800/40 dark:text-neutral-500 dark:border-neutral-700/80 " +
        "cursor-not-allowed pointer-events-none select-none shadow-none";

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-disabled={disabled ? "true" : "false"}
            aria-label={label}
            title={disabled ? "Connected" : "Connect"}
            className={`${base} ${disabled ? blocked : enabled}`}
        >
            {/* 브랜드 아이콘 */}
            {brand === "google" && (
                <img
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/120px-Google_%22G%22_logo.svg.png"
                    alt="googe" className="w-4 h-4"/>
            )}
            {brand === "github" && (
                <i
                    className="fab fa-github text-md"
                    aria-hidden="true"
                />
            )}

            <span className="tracking-tight">{label}</span>
        </button>
    );
}

function PageSkeleton() {
    return (
        <section className="h-screen flex flex-col px-4 overflow-hidden">
            {/* Top tabs + divider */}
            <div className="shrink-0">
                <div className="mx-auto max-w-6xl">
                    <div className="flex items-center">
                        <div className="p-4 -mb-px">
                            <div className="h-6 w-24 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse"/>
                        </div>
                        <div className="p-4 -mb-px">
                            <div className="h-6 w-28 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse"/>
                        </div>
                        <div className="p-4 -mb-px">
                            <div className="h-6 w-20 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse"/>
                        </div>
                    </div>
                    <div className="h-px w-full bg-neutral-200 dark:bg-neutral-700"/>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto pt-10">
                <div className="mx-auto max-w-6xl pb-16">
                    <div className="flex gap-6 px-2">
                        {/* LEFT: 고정 폭 컬럼 (아바타/알림/탈퇴) */}
                        <div className="w-[380px] shrink-0 space-y-4">
                            {/* Avatar card */}
                            <div
                                className="rounded-2xl border border-neutral-200 dark:border-neutral-700 p-4 animate-pulse">
                                <div className="flex items-start gap-4">
                                    <div className="h-28 w-28 rounded-full bg-neutral-200 dark:bg-neutral-800"/>
                                    <div className="flex-1 space-y-3">
                                        <div className="h-7 w-56 rounded bg-neutral-200 dark:bg-neutral-800"/>
                                        <div className="h-4 w-40 rounded bg-neutral-200 dark:bg-neutral-800"/>
                                        <div className="flex gap-2 pt-1">
                                            <div className="h-8 w-24 rounded-lg bg-neutral-200 dark:bg-neutral-800"/>
                                            <div className="h-8 w-24 rounded-lg bg-neutral-200 dark:bg-neutral-800"/>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Notification settings */}
                            <div
                                className="rounded-2xl border border-neutral-200 dark:border-neutral-700 p-4 animate-pulse">
                                <div className="h-5 w-40 rounded bg-neutral-200 dark:bg-neutral-800 mb-3"/>
                                {[...Array(4)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-between py-3 ${
                                            i !== 0 ? "border-t border-neutral-200 dark:border-neutral-700" : ""
                                        }`}
                                    >
                                        <div className="space-y-2 pr-4">
                                            <div className="h-4 w-28 rounded bg-neutral-200 dark:bg-neutral-800"/>
                                            <div className="h-3 w-48 rounded bg-neutral-200 dark:bg-neutral-800"/>
                                        </div>
                                        <div
                                            className="h-8 w-16 rounded border border-neutral-300 dark:border-neutral-700"/>
                                    </div>
                                ))}
                            </div>

                            {/* Delete account */}
                            <div
                                className="rounded-2xl border border-neutral-200 dark:border-neutral-700 p-4 animate-pulse">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-2 pr-4">
                                        <div className="h-5 w-36 rounded bg-neutral-200 dark:bg-neutral-800"/>
                                        <div className="h-3 w-60 rounded bg-neutral-200 dark:bg-neutral-800"/>
                                    </div>
                                    <div
                                        className="h-8 w-28 rounded border border-neutral-300 dark:border-neutral-700"/>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: 가변 컬럼 (README 카드 + 여분 카드) */}
                        <div className="flex-1 flex flex-col gap-4 min-w-0">
                            {/* Profile README */}
                            <div
                                className="rounded-2xl border border-neutral-200 dark:border-neutral-700 p-4 animate-pulse">
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="h-7 w-44 rounded bg-neutral-200 dark:bg-neutral-800"/>
                                    <div
                                        className="flex items-center overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700">
                                        <div className="h-7 w-16 bg-neutral-200 dark:bg-neutral-800"/>
                                        <div className="h-7 w-16 bg-neutral-200/80 dark:bg-neutral-800/80"/>
                                    </div>
                                </div>
                                <div className="h-[420px] w-full rounded-md bg-neutral-200 dark:bg-neutral-800"/>
                                <div className="mt-3 flex justify-end">
                                    <div className="h-9 w-20 rounded bg-neutral-200 dark:bg-neutral-800"/>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}