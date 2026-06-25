// 메인 지도 화면(Tesla): 좌(목록·검색·필터) + 중앙(지도) + 우(선택 단지 요약)
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "../components/layout/Header";
import UnitMap from "../components/map/UnitMap";
import SummaryTable from "../components/dashboard/SummaryTable";
import { Loading, ErrorMessage } from "../components/common/Feedback";
import { fetchSites, fetchSite, fetchSummary } from "../services/unitApi";
import type { Site, UnitStatus } from "../types";
import { STATUS_LABEL, STATUS_COLOR } from "../utils/status";

// 사이드바 필터: 전체 / 정상 연결(normal) / 개발 예정(offline) 3개만
const STATUS_FILTERS: (UnitStatus | "all")[] = ["all", "normal", "offline"];
const FILTER_LABEL: Record<string, string> = {
  all: "전체",
  normal: "정상 연결",
  offline: "개발 예정",
};

function StatusDot({ status }: { status: UnitStatus }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: STATUS_COLOR[status] }}
    />
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<UnitStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 실시간 연동: 10초마다 자동 갱신
  const sitesQ = useQuery({ queryKey: ["sites"], queryFn: fetchSites, refetchInterval: 10000 });
  const summaryQ = useQuery({ queryKey: ["summary"], queryFn: fetchSummary, refetchInterval: 10000 });
  const detailQ = useQuery({
    queryKey: ["site", selectedId],
    queryFn: () => fetchSite(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 10000,
  });

  const filtered = useMemo(() => {
    const list = sitesQ.data ?? [];
    return list.filter(
      (s) =>
        (statusFilter === "all" || s.status === statusFilter) &&
        (s.siteName.includes(query) || s.siteId.includes(query.toLowerCase())),
    );
  }, [sitesQ.data, query, statusFilter]);

  return (
    <div className="flex h-full flex-col bg-white">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex min-h-[52vh] flex-1 overflow-hidden">
        {/* 좌측 사이드바 */}
        <aside className="flex w-96 flex-col border-r-2 border-pale bg-white">
          <div className="border-b border-cloud p-4">
            <input
              className="w-full rounded-tesla border border-pale px-3 py-2 text-base text-carbon outline-none placeholder:text-silver focus:border-electric"
              placeholder="발전소명 / ID 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-tesla px-2.5 py-1 text-sm ${
                    statusFilter === f
                      ? "font-medium text-carbon"
                      : "text-pewter hover:text-carbon"
                  }`}
                >
                  {FILTER_LABEL[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sitesQ.isLoading && <Loading />}
            {sitesQ.isError && <ErrorMessage message="발전소 목록을 불러오지 못했습니다." />}
            {filtered.map((s) => (
              <button
                key={s.siteId}
                onClick={() => setSelectedId(s.siteId)}
                className={`flex w-full items-center justify-between border-b border-cloud px-4 py-3 text-left hover:bg-ash ${
                  selectedId === s.siteId ? "bg-ash" : ""
                }`}
              >
                <span className="flex items-center gap-2">
                  <StatusDot status={s.status} />
                  <span>
                    <span className="text-base text-carbon">{s.siteName}</span>
                    <br />
                    <span className="text-sm text-silver">{s.region}</span>
                  </span>
                </span>
                <span className="text-sm text-pewter">{FILTER_LABEL[s.status] ?? STATUS_LABEL[s.status]}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* 중앙 지도 */}
        <main className="relative flex-1">
          {sitesQ.data && <UnitMap sites={filtered} onSelect={(s: Site) => setSelectedId(s.siteId)} />}
        </main>

        {/* 우측 요약 패널 */}
        <aside className="w-[28rem] overflow-y-auto border-l-2 border-pale bg-white p-5">
          {!selectedId && <p className="text-base text-silver">지도에서 발전소를 선택하세요.</p>}
          {detailQ.isLoading && <Loading />}
          {detailQ.data && (
            <div>
              <h2 className="text-xl font-medium text-carbon">{detailQ.data.siteName}</h2>
              <p className="text-sm text-pewter">{detailQ.data.region}</p>
              <p className="mt-1 text-sm text-silver">
                위도 {detailQ.data.latitude.toFixed(4)} / 경도 {detailQ.data.longitude.toFixed(4)}
              </p>
              <h3 className="mt-6 text-sm font-medium text-graphite">호기 목록</h3>
              {detailQ.data.units.length === 0 && (
                <p className="mt-2 text-sm text-silver">등록된 예측 호기가 없습니다(향후 확장).</p>
              )}
              <div className="mt-3 space-y-2">
                {detailQ.data.units.map((u) => (
                  <button
                    key={u.unitId}
                    onClick={() => navigate(`/dashboard/units/${u.unitId}`)}
                    className="flex w-full items-center justify-between rounded-tesla border border-cloud px-3 py-2.5 text-left hover:border-electric"
                  >
                    <span className="flex items-center gap-2">
                      <StatusDot status={u.status} />
                      <span className="text-base text-carbon">{u.unitName}</span>
                    </span>
                    <span className="text-sm text-silver">{STATUS_LABEL[u.status]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* 하단 종합 현황표 (전 발전소) */}
      {summaryQ.isError && <ErrorMessage message="종합 현황을 불러오지 못했습니다." />}
      <SummaryTable summary={summaryQ.data ?? []} />
      </div>
    </div>
  );
}
