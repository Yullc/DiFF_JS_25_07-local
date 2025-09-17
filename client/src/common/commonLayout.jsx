// src/common/commonLayout.jsx
'use client';

import Header from '@/common/header';
import React, {useCallback, useContext, useEffect, useMemo, useRef, useState, createContext} from "react";
import {useRouter, usePathname} from 'next/navigation';
import SidebarLayout from '@/common/sidebarLayout';
import LayMenu from '@/common/layMenu';
import clsx from 'clsx';
import ConfirmDialog from '@/common/alertModal';

// alert
const DialogContext = createContext(null);

export const useDialog = () => {
    const ctx = useContext(DialogContext);
    if (!ctx) throw new Error('useDialog must be used within commonLayout');
    return ctx;
};

function isExpired(token, skewMs = 30_000) {
    if (!token) return true;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload?.exp) return true;
        const now = Date.now() / 1000;
        return now >= (payload.exp - skewMs / 1000);
    } catch {
        return true;
    }
}

export default function CommonLayout({children, modal, pageTitle = 'DiFF'}) {
    const router = useRouter();
    const pathname = usePathname();
    const [accessToken, setAccessToken] = useState(null);

    const [alertOpen, setAlertOpen] = useState(false);
    const [alertCfg, setAlertCfg] = useState({});
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmCfg, setConfirmCfg] = useState({});
    const confirmResolveRef = useRef(null); // confirm 결과 저장

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const accessToken = params.get("accessToken");
            const refreshToken = params.get("refreshToken");
            if (accessToken && refreshToken) {
                localStorage.setItem("accessToken", accessToken);
                localStorage.setItem("refreshToken", refreshToken);
                setAccessToken(accessToken);
                router.replace("/DiFF/home/main");
            } else {
                // 초기 로드 시 localStorage에서 토큰 읽기
                const saved = localStorage.getItem("accessToken");
                setAccessToken(saved);
            }
        }
    }, [router]);

    // 다른 탭에서 로그인/로그아웃해도 동기화
    useEffect(() => {
        const onStorage = (e) => {
            if (e.key === 'accessToken') {
                setAccessToken(e.newValue);
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const isAuthed = useMemo(() => accessToken && !isExpired(accessToken), [accessToken]);

    const isHomeMain = pathname?.startsWith('/DiFF/home/main');
    const useDarkColor = isHomeMain && !isAuthed;

    const alert = useCallback((cfg = {}) => {
        setAlertCfg({
            intent: 'info',
            title: 'Notice',
            message: null,
            confirmText: 'OK',
            showCancel: false,
            closeOnConfirm: true,
            closeOnOverlayClick: true,
            ...cfg,
        });
        setAlertOpen(true);
    }, []);

    const confirm = useCallback((cfg = {}) => {
        return new Promise((resolve) => {
            confirmResolveRef.current = resolve;
            // onConfirm / onCancel 래핑해서 Promise 해결
            const wrap = {
                intent: 'danger',
                title: 'Are you sure?',
                message: null,
                confirmText: 'Confirm',
                cancelText: 'Cancel',
                showCancel: true,
                closeOnConfirm: true,
                closeOnOverlayClick: false,
                ...cfg,
            };
            const userOnConfirm = wrap.onConfirm;
            const userOnCancel = wrap.onCancel;
            wrap.onConfirm = () => {
                userOnConfirm && userOnConfirm();
                setConfirmOpen(false);
                confirmResolveRef.current?.(true);
                confirmResolveRef.current = null;
            };
            wrap.onCancel = () => {
                userOnCancel && userOnCancel();
                setConfirmOpen(false);
                confirmResolveRef.current?.(false);
                confirmResolveRef.current = null;
            };
            setConfirmCfg(wrap);
            setConfirmOpen(true);
        });
    }, []);

    // 모달이 ESC/오버레이로 닫힐 때 confirm Promise도 정리
    const handleConfirmOpenChange = useCallback((v) => {
        setConfirmOpen(v);
        if (!v && confirmResolveRef.current) {
            confirmResolveRef.current(false);
            confirmResolveRef.current = null;
        }
    }, []);

    return (
        <DialogContext.Provider value={{alert, confirm}}>
            <div className="text-neutral-600 scrollbar-none">
                {useDarkColor && <div className="fixed inset-0 -z-10 dark:bg-neutral-900"/>}
                <Header/>
                <div
                    id={isAuthed ? 'appScroll' : undefined}
                    data-scroll-root={isAuthed ? '' : undefined}
                    className={clsx(
                        'flex gap-0',
                        isAuthed && 'overflow-y-auto h-screen'
                    )}>
                    {/* 로그인 상태 */}
                    <SidebarLayout>
                        <LayMenu/>
                    </SidebarLayout>

                    {/* 메인 컨텐츠 영역 */}
                    <main className={clsx('flex-1 min-w-0',
                        isAuthed && 'pt-20'
                    )}>
                        {children}
                        {modal}
                    </main>
                </div>
                <ConfirmDialog open={alertOpen} onOpenChange={setAlertOpen} {...alertCfg} />
                <ConfirmDialog open={confirmOpen} onOpenChange={handleConfirmOpenChange} {...confirmCfg} />
            </div>
        </DialogContext.Provider>
    )
        ;
}
