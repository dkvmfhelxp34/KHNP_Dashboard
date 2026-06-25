// 섹션 제목 옆 아이콘 배지(21st.dev 스타일: 연한 라운드 사각 + 라인 아이콘).
// 단조로운 파란 원 대신 섹션별 의미 아이콘으로 표시.
import type { ReactNode } from "react";

type Variant = "forecast" | "panel" | "summary";

const ICON: Record<Variant, ReactNode> = {
  // 관측소 예보 현황: 모니터링 펄스(activity)
  forecast: <path d="M3 12h3l2.5-6 3.5 12 2.5-6H21" />,
  // 현황판: 2x2 그리드(패널)
  panel: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </>
  ),
  // 종합 현황: 목록(list)
  summary: (
    <>
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="1.3" />
      <circle cx="4" cy="12" r="1.3" />
      <circle cx="4" cy="18" r="1.3" />
    </>
  ),
};

export default function SectionIcon({ variant }: { variant: Variant }) {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-electric/10 text-electric ring-1 ring-inset ring-electric/15">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ICON[variant]}
      </svg>
    </span>
  );
}
