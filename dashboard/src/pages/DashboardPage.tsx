// 메인 대시보드. 새 레이아웃:
//   좌측 사이드바 = 상단 현황판(호기별 아이콘) + 하단 소형 지도
//   우측 = 종합 현황(세로형 대형)
//   호기 아이콘/행 클릭 → 시계열 상세 팝업(UnitDetailModal)
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "../components/layout/Header";
import UnitMap from "../components/map/UnitMap";
import StationStatus from "../components/dashboard/StationStatus";
import StatusPanel from "../components/dashboard/StatusPanel";
import SummaryPanel from "../components/dashboard/SummaryPanel";
import UnitDetailModal from "../components/dashboard/UnitDetailModal";
import { ErrorMessage } from "../components/common/Feedback";
import { fetchSites, fetchSummary } from "../services/unitApi";

export default function DashboardPage() {
  // 클릭한 호기 → 시계열 팝업 (null 이면 닫힘)
  const [popupUnitId, setPopupUnitId] = useState<string | null>(null);

  // 실시간 연동: 10초마다 자동 갱신
  const sitesQ = useQuery({ queryKey: ["sites"], queryFn: fetchSites, refetchInterval: 10000 });
  const summaryQ = useQuery({ queryKey: ["summary"], queryFn: fetchSummary, refetchInterval: 10000 });
  const summary = summaryQ.data ?? [];

  return (
    <div className="flex h-full flex-col bg-mist">
      <Header />

      {/* 작은 화면: 세로 스택(통째 스크롤) / lg 이상: 좌-우 2단(각자 스크롤) */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* 좌측 사이드바 — 넓게, 스크롤 없이 전체가 보이도록 구성 */}
        <aside className="flex shrink-0 flex-col border-b border-pale bg-white lg:w-[28rem] lg:border-b-0 lg:border-r-2 xl:w-[31rem]">
          {/* 상단: 관측소 현황 + 현황판(호기별 아이콘) — 남은 공간 차지, 스크롤 없음 */}
          <div className="min-h-[18rem] flex-1 overflow-hidden lg:min-h-0">
            {summaryQ.isError && <ErrorMessage message="현황 데이터를 불러오지 못했습니다." />}
            <StationStatus summary={summary} />
            <StatusPanel
              summary={summary}
              selectedUnitId={popupUnitId}
              onSelectUnit={setPopupUnitId}
            />
          </div>
          {/* 하단: 구분선 + 지도 제목 + 소형 지도 */}
          <div className="shrink-0 border-t-2 border-pale">
            <div className="flex items-center gap-1.5 border-b border-cloud bg-mist px-3 py-1.5 text-sm font-semibold text-carbon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 21s7-5.686 7-11a7 7 0 10-14 0c0 5.314 7 11 7 11z"
                  stroke="#0B5CAB" strokeWidth="2" strokeLinejoin="round"
                />
                <circle cx="12" cy="10" r="2.5" fill="#0B5CAB" />
              </svg>
              원자력발전소 위치
            </div>
            <div className="h-[23vh]">
              {sitesQ.data && <UnitMap sites={sitesQ.data} onSelect={() => {}} />}
            </div>
          </div>
        </aside>

        {/* 우측: 종합 현황(세로형 대형) */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white p-4 lg:p-6">
          {summaryQ.isError && <ErrorMessage message="종합 현황을 불러오지 못했습니다." />}
          <SummaryPanel summary={summary} onSelectUnit={setPopupUnitId} />
        </main>
      </div>

      {/* 시계열 상세 팝업 */}
      {popupUnitId && (
        <UnitDetailModal unitId={popupUnitId} onClose={() => setPopupUnitId(null)} />
      )}
    </div>
  );
}
