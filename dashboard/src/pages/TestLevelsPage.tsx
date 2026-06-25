// 테스트 전용 페이지 (/test/levels): 임의 데이터로 예보 1~5단계를 모두 표출.
// 실제 DB 연동 대시보드(/dashboard)는 건드리지 않는다. 로그인/백엔드 불필요.
import { useState } from "react";
import StationStatus from "../components/dashboard/StationStatus";
import StatusPanel from "../components/dashboard/StatusPanel";
import SummaryPanel from "../components/dashboard/SummaryPanel";
import { testLevelSummary } from "../mocks/testLevelData";

export default function TestLevelsPage() {
  const [sel, setSel] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col bg-mist">
      {/* 테스트 페이지 표식 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-cloud bg-white px-6 py-3 text-sm">
        <span className="rounded-tesla bg-electric px-2 py-0.5 text-xs font-medium text-white">TEST</span>
        <span className="font-medium text-carbon">예보 단계 표출 테스트 (1~5단계)</span>
        <span className="text-pewter">임의 데이터 · 실제 DB 대시보드(/dashboard)와 무관</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* 좌측: 현황판(아이콘 색 = 단계색) */}
        <aside className="flex shrink-0 flex-col border-b border-pale bg-white lg:w-[28rem] lg:border-b-0 lg:border-r-2 xl:w-[31rem]">
          <div className="min-h-[18rem] flex-1 overflow-hidden lg:min-h-0">
            <StationStatus summary={testLevelSummary} />
            <StatusPanel summary={testLevelSummary} selectedUnitId={sel} onSelectUnit={setSel} />
          </div>
        </aside>

        {/* 우측: 종합 현황(경보·심각 행 하이라이트) */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white p-4 lg:p-6">
          <SummaryPanel summary={testLevelSummary} onSelectUnit={setSel} />
        </main>
      </div>
    </div>
  );
}
