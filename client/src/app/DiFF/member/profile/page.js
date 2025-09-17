// member/profile/page.js
'use client';
import ReactMarkdown from "react-markdown";
import {useEffect, useState, Suspense, useRef} from 'react';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import {Prism as SyntaxHighlighter} from "react-syntax-highlighter";
import {oneDark} from "react-syntax-highlighter/dist/cjs/styles/prism";

import {
    fetchUser,
    uploadProfileImg,
    followMember,
    unfollowMember,
    getFollowingList,
    getFollowerList,
} from '@/lib/UserAPI';
import {useDialog} from "@/common/commonLayout";

export default function ProfileTab() {
    return (
        <Suspense fallback={<div className="p-8 text-sm">로딩...</div>}>
            <ProfileInner/>
        </Suspense>
    );
}

function ProfileInner() {
    const router = useRouter();
    const { alert } = useDialog();
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [member, setMember] = useState(null);
    const [isMyProfile, setIsMyProfile] = useState(false);
    const [profileUrl, setProfileUrl] = useState('');

    const [followingCount, setFollowingCount] = useState(0);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingList, setFollowingList] = useState([]);
    const [followerList, setFollowerList] = useState([]);
    const [openModal, setOpenModal] = useState(null);
    const [githubUrl, setGithubUrl] = useState('');
    const [hoverUnfollow, setHoverUnfollow] = useState(false);

    const pickGithubUrl = (m) =>
        typeof m?.githubUrl === 'string' ? m.githubUrl.trim() : '';

    const normalizeUrl = (u) =>
        u && !/^https?:\/\//i.test(u) ? `https://${u}` : u;

    useEffect(() => {
        const accessToken = typeof window !== 'undefined' && localStorage.getItem('accessToken');
        const myNickName = typeof window !== 'undefined' && localStorage.getItem('nickName');

        if (!accessToken) {
            router.replace('/DiFF/home/main');
            return;
        }

        const nickName = searchParams.get("nickName");

        fetchUser(nickName)
            .then(async (res) => {
                const fetchedMember = res.member;
                setMember(fetchedMember);
                setProfileUrl(fetchedMember?.profileUrl || "");
                setGithubUrl(normalizeUrl(pickGithubUrl(fetchedMember)));
                setLoading(false);

                if (!nickName || nickName === myNickName) {
                    setIsMyProfile(true);
                } else {
                    setIsMyProfile(false);

                    const followRes = await getFollowingList(myNickName);

                    const list = followRes.followingList || followRes.data1 || [];

                    const following = list.some(m => m.id === fetchedMember.id);

                    setMember(prev => ({...prev, isFollowing: following}));
                }
            })
            .catch(err => {
                setLoading(false);
                router.replace('/DiFF/home/main');
            });
    }, [router, searchParams]);

    useEffect(() => {
        setGithubUrl(normalizeUrl(pickGithubUrl(member)));
    }, [member?.githubUrl]);

    useEffect(() => {
        const nickName = searchParams.get("nickName");

        const fetchCounts = async () => {
            try {
                const followingRes = await getFollowingList(nickName);
                const followerRes = await getFollowerList(nickName);

                const followingList = followingRes.followingList || followingRes.data1 || [];
                const followerList = followerRes.followerList || followerRes.data1 || [];

                setFollowingCount(followingList.length);
                setFollowerCount(followerList.length);
            } catch (err) {
            }
        };

        fetchCounts();
    }, [searchParams]);

    useEffect(() => {
        const nickName = searchParams.get("nickName");

        if (openModal === "follower") {
            getFollowerList(nickName)
                .then((res) => {
                    setFollowerList(res.followerList || res.data1 || []);
                })
                .catch((err) => null);
        }

        if (openModal === "following") {
            getFollowingList(nickName)
                .then((res) => {
                    setFollowingList(res.followingList || res.data1 || []);
                })
                .catch((err) => null);
        }
    }, [openModal, searchParams]);

    if (loading) return <div>loading...</div>;
    if (!member) return null;

    const repoHref =
        isMyProfile ? '/DiFF/member/repository'
            : `/DiFF/member/repository?nickName=${encodeURIComponent(member?.nickName ?? '')}`;

    return (
        <div className="w-full h-screen overflow-hidden mx-4 dark:text-neutral-300">
                <div className="h-full">
                    <div className="mx-auto flex h-full">
                        <main className="flex-1 flex flex-col min-h-0 max-w-6xl">

                {err && (
                    <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-700">{err}</div>
                )}

                {/* Tabs */}
                <div className="bg-white dark:bg-neutral-900 flex items-center text-neutral-500">
                    <TopTab active href="#" label="Profile"/>
                    <TopTab href={`${repoHref}`} label="Repositories"/>
                    <TopTab href="/DiFF/member/settings" label="Settings"
                            visible={isMyProfile}/>
                </div>

                <div className="h-px w-full bg-neutral-200 dark:bg-neutral-700"/>

                <div className="flex w-full overflow-y-auto min-h-0 pt-10">

                    <aside className="w-[20%] min-w-[180px] mx-8">
                        <div className="flex flex-col items-start">
                            {/* 프로필 이미지 */}
                            <div
                                className="relative h-28 w-28 overflow-hidden rounded-full border self-center
                                bg-gray-100 border-gray-300
                                dark:text-neutral-500 dark:bg-neutral-600 dark:border-neutral-700">
                                {profileUrl ? (
                                    <img src={profileUrl} alt="avatar" className="h-full w-full object-cover"/>
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-6xl">
                                        <i className="fa-solid fa-skull"></i>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 self-center text-center">
                                {/*닉네임*/}
                                <div className="text-xl font-semibold">{member.nickName}</div>

                                {/* 소셜, 팔로우 */}
                                <div className="UserProfile_icons__mCrr mt-3 flex items-center justify-center gap-4">
                                    {/* GitHub */}
                                    {githubUrl && (
                                        <a
                                            href={githubUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            data-testid="github"
                                            className="inline-flex items-center justify-center w-12 h-12
                                            text-gray-400 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors duration-100"
                                            aria-label="GitHub profile"
                                            title="GitHub profile"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="currentColor"
                                                viewBox="0 0 24 24"
                                                className="h-8 w-8"
                                            >
                                                <path
                                                    d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.29 9.4 7.86 10.94.58.1.79-.25.79-.56v-2.02c-3.2.7-3.87-1.54-3.87-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.73.08-.72.08-.72 1.18.08 1.8 1.22 1.8 1.22 1.04 1.78 2.73 1.27 3.4.97.1-.75.4-1.27.72-1.56-2.55-.29-5.23-1.28-5.23-5.72 0-1.27.46-2.3 1.22-3.12-.12-.3-.53-1.48.12-3.09 0 0 .99-.32 3.24 1.19a11.3 11.3 0 0 1 5.9 0c2.25-1.51 3.24-1.19 3.24-1.19.65 1.61.24 2.79.12 3.09.76.82 1.22 1.85 1.22 3.12 0 4.45-2.69 5.42-5.25 5.7.41.35.77 1.05.77 2.12v3.14c0 .31.21.66.79.55A10.5 10.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/>
                                            </svg>
                                        </a>
                                    )}

                                    {/* mailto:) */}
                                    {member.email && (
                                        <a
                                            href={`mailto:${member.email}`}
                                            className="inline-flex items-center justify-center w-12 h-12 rounded-full
                                            text-gray-400 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors duration-100"
                                            aria-label="이메일 보내기"
                                            title={member.email}
                                            data-testid="email"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="currentColor"
                                                viewBox="0 0 32 32"
                                                className="h-8 w-8"
                                            >
                                                <path
                                                    d="M16 16.871 1.019 5H30.98L16 16.871zm0 3.146L1 8.131V27h30V8.131L16 20.017z"/>
                                            </svg>
                                        </a>
                                    )}

                                    {/* 팔로우/언팔로우 */}
                                    {!isMyProfile && member?.id && (
                                        <div className="flex">
                                            <button
                                                onMouseEnter={() => setHoverUnfollow(true)}
                                                onMouseLeave={() => setHoverUnfollow(false)}
                                                onClick={async () => {
                                                    try {
                                                        if (member.isFollowing) {
                                                            await unfollowMember(member.id);
                                                            setMember(prev => ({...prev, isFollowing: false}));
                                                            typeof setFollowerCount === 'function' &&
                                                            setFollowerCount(prev => Math.max(0, prev - 1));
                                                        } else {
                                                            await followMember(member.id);
                                                            setMember(prev => ({...prev, isFollowing: true}));
                                                            typeof setFollowerCount === 'function' &&
                                                            setFollowerCount(prev => prev + 1);
                                                        }
                                                    } catch (err) {
                                                        console.error("❌ 팔로우/언팔로우 실패:", err);
                                                        alert({ intent: "danger", title: "Failed to follow request." });
                                                    }
                                                }}
                                                className={`py-1 text-sm rounded-full border transition w-20 
                                                    ${member.isFollowing
                                                    ? hoverUnfollow
                                                        ? "text-red-500 border hover:border-red-500"
                                                        : "border text-gray-500 bg-gray-100 " +
                                                        "dark:bg-neutral-800/40 dark:text-neutral-500 dark:border-neutral-700/80 "
                                                    : "text-gray-700 border-gray-700 hover:bg-gray-100 " +
                                                    "dark:hover:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-300"
                                                }`}
                                                aria-label={member.isFollowing
                                                    ? (hoverUnfollow ? "Unfollow" : "Following")
                                                    : "Follow"
                                                }
                                            >
                                                {member.isFollowing ? (hoverUnfollow ? "Unfollow" : "Following") : "Follow"}
                                            </button>
                                        </div>
                                    )}
                                </div>

                            </div>

                            {/* 팔로잉/팔로워 */}
                            <div className="mt-4 flex items-center gap-4 text-sm self-center">
                                <i className="fa-solid fa-user-group text-md"></i>
                                <button
                                    onClick={() => setOpenModal('follower')}
                                    className="flex items-center gap-2 hover:underline"
                                >
                                    <span className="opacity-70">Follower </span> {followerCount}
                                </button>
                                <button
                                    onClick={() => setOpenModal('following')}
                                    className="flex items-center gap-2 hover:underline"
                                >
                                    <span className="opacity-70">Following </span> {followingCount}
                                </button>
                            </div>


                            {/* 본인 프로필일 때만 표시 */}
                            {isMyProfile && (
                                <div className="mt-3 flex w-full flex-col gap-2">
                                    {/* 구분선 */}
                                    <div className="my-4 h-px w-full bg-gray-300 self-center"/>

                                    {/* Stats */}
                                    <div className="text-left px-5">
                                        <h4 className="text-xl font-semibold mb-3">Stats</h4>
                                        <ul className="text-sm leading-7">
                                            <li>
                                                Likes : <span className="font-medium">{member.extra__likeCounts}</span>
                                            </li>
                                            <li>
                                                Repositories : <span
                                                className="font-medium">{member.extra__repoCounts}</span>
                                            </li>
                                            <li>
                                                Posts : <span className="font-medium">{member.extra__postCounts}</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* Right */}
                    <div className="flex-1 ml-8">
                        <section className="mb-8">
                            <span className="text-sm rounded-full py-1 px-3 bg-gray-200 dark:bg-neutral-700 dark:text-neutral-400">
                                Introduction written by {member.nickName}
                            </span>
                            <div className="min-h-[120px] prose dark:prose-invert max-w-none markdown dark:text-neutral-300 mb-20">
                                {member?.introduce ? (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeRaw]}
                                        components={{
                                            code({node, inline, className, children, ...props}) {
                                                const match = /language-(\w+)/.exec(className || "");
                                                return !inline && match ? (
                                                    <SyntaxHighlighter
                                                        style={oneDark}
                                                        language={match[1]}
                                                        PreTag="div"
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
                                        {member.introduce}

                                    </ReactMarkdown>
                                ) : (
                                    <div className="h-20 w-full mx-10 flex items-center">
                                    No README Yet.
                                    </div>
                                )}
                                <div className="h-20 w-full"/>
                            </div>
                        </section>
                    </div>
                </div>

                {/* 목록 모달 */}
                {openModal && (
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
                        onClick={() => setOpenModal(null)}
                    >
                        <div
                            className="w-96 rounded-2xl border border-neutral-200 bg-white/80 p-3 pb-5 shadow-lg backdrop-blur
                                 text-neutral-800
                                 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-300"
                            onClick={(e) => e.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="connections-title"
                        >
                            {/* 헤더 */}
                            <div className="mb-2 flex items-center justify-between">
                                <h2 id="connections-title" className="m-2 text-lg font-semibold">Connections</h2>
                                <button
                                    onClick={() => setOpenModal(null)}
                                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition
                                                hover:bg-neutral-100/60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900/60"
                                >
                                    Close
                                </button>
                            </div>

                            {/* 탭 */}
                            <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-neutral-300 bg-neutral-100/60 p-1
                                            dark:border-neutral-700 dark:bg-neutral-900/60">
                                <button
                                    type="button"
                                    onClick={() => setOpenModal('follower')}
                                    className={`rounded-lg px-3 py-2 text-sm transition
                                        ${openModal === 'follower'
                                        ? 'bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                                        : 'text-neutral-700 hover:bg-neutral-200/50 dark:text-neutral-300 dark:hover:bg-neutral-800/50'}`}
                                    aria-pressed={openModal === 'follower'}
                                >
                                    Followers
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOpenModal('following')}
                                    className={`rounded-lg px-3 py-2 text-sm transition
                                         ${openModal === 'following'
                                        ? 'bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                                        : 'text-neutral-700 hover:bg-neutral-200/50 dark:text-neutral-300 dark:hover:bg-neutral-800/50'}`}
                                    aria-pressed={openModal === 'following'}
                                >
                                    Following
                                </button>
                            </div>

                            {/* 리스트 */}
                            {(() => {
                                const list = (openModal === 'follower' ? followerList : followingList) ?? [];

                                return list.length > 0 ? (
                                    <ul className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-neutral-200 bg-white/70
                                                  dark:border-neutral-700 dark:bg-neutral-900/60">
                                        {list.map((u, idx) => {
                                            const imgSrc =
                                                (typeof u?.profileImg === 'string' && u.profileImg.trim()) ||
                                                (typeof u?.profileUrl === 'string' && u.profileUrl.trim()) ||
                                                null;

                                            return (
                                                <li
                                                    key={u?.id ?? u?.nickName ?? idx}
                                                    className="flex items-center gap-3"
                                                    onClick={() => setOpenModal(null)}
                                                >
                                                    <Link
                                                        href={`/DiFF/member/profile?nickName=${encodeURIComponent(u?.nickName ?? '')}`}
                                                        className="w-full flex items-center gap-3 p-4"
                                                    >
                                                        {imgSrc ? (
                                                            <img
                                                                src={imgSrc}
                                                                alt={u?.nickName || 'user'}
                                                                className="h-8 w-8 rounded-full border object-cover dark:border-neutral-700"
                                                            />
                                                        ) : (
                                                            <div
                                                                className="h-8 w-8 rounded-full border flex items-center justify-center
                                                                   bg-gray-100 border-gray-300
                                                                   dark:text-neutral-500 dark:bg-neutral-600 dark:border-neutral-700"
                                                            >
                                                                <i className="fa-solid fa-skull" />
                                                            </div>
                                                        )}

                                                        <span className="truncate">{u?.nickName}</span>
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p className="px-3 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
                                        {openModal === 'follower' ? 'No followers yet.' : 'Not following anyone yet.'}
                                    </p>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </main>
                    </div>
                </div>
        </div>
    );
}

function TopTab({visible = true, href, label, active}) {
    if (!visible) return null;

    return active ? (
        <span
            className="p-4 -mb-px font-semibold text-black dark:text-neutral-300 border-b-2 border-black dark:border-neutral-300">
      {label}
    </span>
    ) : (
        <Link
            href={href}
            className="p-4 -mb-px hover:text-neutral-700 dark:hover:text-neutral-300"
        >
            {label}
        </Link>
    );
}