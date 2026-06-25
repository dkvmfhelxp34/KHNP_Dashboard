// 메인 대시보드.
//   좌측 사이드바 = 관측소 현황 + 현황판(호기별 아이콘)
//   우측 = 종합 현황(세로형 대형)
//   호기 아이콘/행 클릭 → 시계열 상세 팝업(UnitDetailModal)
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "../components/layout/Header";
import StationStatus from "../components/dashboard/StationStatus";
import StatusPanel from "../components/dashboard/StatusPanel";
import SummaryPanel from "../components/dashboard/SummaryPanel";
import UnitDetailModal from "../components/dashboard/UnitDetailModal";
import { ErrorMessage } from "../components/common/Feedback";
import { fetchSummary } from "../services/unitApi";

export default function DashboardPage() {
  // 클릭한 호기 → 시계열 팝업 (null 이면 닫힘)
  const [popupUnitId, setPopupUnitId] = useState<string | null>(null);

  // 실시간 연동: 10초마다 자동 갱신
  const summaryQ = useQuery({ queryKey: ["summary"], queryFn: fetchSummary, refetchInterval: 10000 });
  const summary = summaryQ.data ?? [];

  return (
    <div className="flex h-full flex-col bg-mist">
      <Header />

      {/* 작은 화면: 세로 스택 / lg 이상: 좌-우 2단(각자 스크롤) */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* 좌측 사이드바 — 관측소 현황 + 현황판 */}
        <aside className="flex shrink-0 flex-col overflow-y-auto border-b border-pale bg-white lg:w-[28rem] lg:border-b-0 lg:border-r-2 xl:w-[31rem]">
          {summaryQ.isError && <ErrorMessage message="현황 데이터를 불러오지 못했습니다." />}
          <StationStatus summary={summary} />
          <StatusPanel
            summary={summary}
            selectedUnitId={popupUnitId}
            onSelectUnit={setPopupUnitId}
          />
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
