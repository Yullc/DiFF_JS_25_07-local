'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signUp } from '@/lib/UserAPI';
import {useDialog} from "@/common/commonLayout";
export default function JoinForm() {
    const [form, setForm] = useState({
        email: '',
        nickName: '',
        loginPw: '',
        checkLoginPw: '',
    });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();
    const { alert } = useDialog();
    const onChange = (e) => setForm(v => ({ ...v, [e.target.name]: e.target.value }));

    const validate = () => {
        if (!form.email.trim() || !form.email.includes('@')) return 'Check the email form';
        if (!form.nickName.trim()) return 'Please enter your nickname.';
        if (!form.loginPw.trim()) return 'Please enter your password.';
        if (form.loginPw !== form.checkLoginPw) return 'Password does not match.';
        return '';
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const msg = validate();
        if (msg) return setError(msg);

        try {
            setSubmitting(true);
            const { loginPw, checkLoginPw, nickName, email } = form;
            const res = await signUp({ loginPw, checkLoginPw, nickName, email });

            const { resultCode, msg: serverMsg, data1: accessToken, data2: refreshToken } = res;

            if (resultCode === 'S-1') {
                alert({
                    intent: "success",
                    title: (
                        <>
                            {serverMsg
                                ? serverMsg.split("\n").map((line, i) => (
                                    <span key={i}>
                            {line}
                                        <br />
                        </span>
                                ))
                                : "Your registration has been completed. Please verify your email address."}
                        </>
                    ),
                });

                if (accessToken) {
                    localStorage.setItem('tokenType', 'Bearer');
                    localStorage.setItem('accessToken', accessToken);
                    localStorage.setItem('refreshToken', refreshToken || '');
                    window.dispatchEvent(new Event('auth-changed'));
                    window.location.href = '/DiFF/home/main';
                }
            } else {
                setError(serverMsg || 'Failed to join');
                setSubmitting(false);
            }
        } catch (err) {
            setError(err?.response?.data?.msg || 'Server error. Please try again later.');
            setSubmitting(false);
        }
    };



    return (
        <form onSubmit={onSubmit} className="max-w-[460px] mx-auto">
            <div className="text-2xl md:text-3xl font-semibold text-center mb-8">Join</div>
            {error && <div className="text-red-500 text-center mb-4">{error}</div>}

            <div className="relative my-4">
                <input
                    type="text"
                    name="email"
                    value={form.email}
                    onChange={onChange}
                    placeholder=" "
                    className="block px-2.5 pb-2.5 pt-4 w-full text-gray-900 bg-transparent rounded-lg white-autofill
                    border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                    autoComplete="username"
                    required
                    disabled={submitting}
                />
                <label htmlFor="email"
                       className="absolute text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10
                       origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100
                       peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2
                       peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto
                       start-1">
                    email</label>
            </div>

            <div className="relative my-4">
                <input
                    type="text"
                    name="nickName"
                    value={form.nickName}
                    onChange={onChange}
                    placeholder=" "
                    className="block px-2.5 pb-2.5 pt-4 w-full text-gray-900 bg-transparent rounded-lg
                    border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                    required
                    disabled={submitting}
                />
                <label htmlFor="Nick Name"
                       className="absolute text-gray-400  duration-300 transform -translate-y-4 scale-75 top-2 z-10
                       origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100
                       peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2
                       peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto
                       start-1">
                    Nick Name</label>
            </div>

            <div className="relative my-4">
                <input
                    type="Password"
                    name="loginPw"
                    value={form.loginPw}
                    onChange={onChange}
                    placeholder=" "
                    className="block px-2.5 pb-2.5 pt-4 w-full text-gray-900 bg-transparent rounded-lg
                    border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                    autoComplete="current-password"
                    required
                    disabled={submitting}
                />
                <label htmlFor="Password"
                       className="absolute text-gray-400 transform -translate-y-4 scale-75 top-2 z-10 origin-[0]
                       bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100
                       peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2
                       peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto
                       start-1">
                    Password</label>
            </div>

            <div className="relative my-4">
                <input
                    type="password"
                    name="checkLoginPw"
                    value={form.checkLoginPw}
                    onChange={onChange}
                    placeholder=" "
                    className="block px-2.5 pb-2.5 pt-4 w-full text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                    autoComplete="current-password"
                    required
                    disabled={submitting}
                />
                <label htmlFor="Password Check"
                       className="absolute text-gray-400 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1">
                    Password Check</label>
            </div>

            <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 font-medium bg-black text-white rounded-lg hover:bg-neutral-800 disabled:opacity-60"
            >
                {submitting ? 'Signing in…' : 'Sign In'}
            </button>

            <div className="text-center mt-6 space-y-2">
                <a
                    href="/login/google"
                    className="flex items-center justify-center gap-3 border border-black text-black bg-white py-3 px-4 rounded-lg mx-auto"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                        <path fill="#EA4335"
                              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4"
                              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05"
                              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853"
                              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        <path fill="none" d="M0 0h48v48H0z"/>
                    </svg>
                    <span>Sign in with Google</span>
                </a>
                <a
                    href="/login/github"
                    className="flex items-center justify-center gap-3 bg-black text-white py-3 px-4 hover:bg-neutral-800 transition rounded-lg mx-auto"
                >
                    <svg viewBox="0 0 16 16" aria-hidden="true" className="w-5 h-5 fill-current">
                        <path
                            d="M8 0C3.58 0 0 3.64 0 8.13c0 3.6 2.29 6.65 5.47 7.73.4.08.55-.18.55-.39 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.5-2.69-.96-.09-.23-.48-.96-.82-1.16-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.22 1.87.87 2.33.66.07-.53.28-.87.51-1.07-1.78-.21-3.64-.91-3.64-4.04 0-.89.31-1.62.82-2.19-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.84A7.5 7.5 0 0 1 8 3.88c.68 0 1.36.09 2 .26 1.53-1.06 2.2-.84 2.2-.84.44 1.1.16 1.92.08 2.12.51.57.82 1.3.82 2.19 0 3.14-1.87 3.83-3.65 4.04.29.25.54.74.54 1.5 0 1.08-.01 1.95-.01 2.22 0 .21.15.47.55.39A8.14 8.14 0 0 0 16 8.13C16 3.64 12.42 0 8 0z"/>
                    </svg>
                    <span>Sign in with GitHub</span>
                </a>
            </div>
        </form>
    );
}