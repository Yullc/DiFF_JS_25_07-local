"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function GAListener() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!pathname) return;

        const url = pathname + (searchParams?.toString() ? `?${searchParams}` : "");

        // gtag 호출
        if (typeof window.gtag === "function") {
            window.gtag("config", "G-45BH0SS23E", {
                page_path: url,
            });

            console.log("📊 GA page_view:", url);
        } else {
            console.warn("⚠️ gtag 함수가 아직 준비되지 않음");
        }
    }, [pathname, searchParams]);

    return null;
}
