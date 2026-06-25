// 좌측 사이드바 최상단 '관측소 예보 현황'.
// 단계 분류는 모두 '예보(forecast) 단계'(UnitSummary.level, 제한치 대비) 기준.
// - 최고 위험 호기(예보 심각 단계)와 현재 수온 표시
// - 예보 단계별 개수(1단계 여유 제외: 심각/경보/주의/관심)
import type { UnitSummary, ForecastLevel } from "../../types";
import { LEVEL_COLOR } from "../../utils/status";

// 단계색의 옅은 배경 틴트
const LEVEL_TINT: Record<ForecastLevel, string> = {
  심각: "#FDECEA",
  경보: "#FEF3E0",
  주의: "#FBFFCC",
  관심: "#E8F0FE",
  여유: "#E6F6F1",
  없음: "#F2F3F5",
};

// 개수 카드로 보여줄 단계(1단계 여유 제외), 위험한 순서
const COUNT_LEVELS: ForecastLevel[] = ["심각", "경보", "주의", "관심"];

export default function StationStatus({ summary }: { summary: UnitSummary[] }) {
  const ok = summary.filter((s) => s.status === "ok");
  const total = ok.length;
  const counts = COUNT_LEVELS.map((lv) => ({ level: lv, n: ok.filter((s) => s.level === lv).length }));

  // 최고 위험은 '심각(5단계)' 호기가 있을 때만. 여러 개면 현재수온 높은 순. 없으면 worst=undefined.
  const worst = ok
    .filter((s) => s.level === "심각")
    .sort((a, b) => (b.currentValue ?? -Infinity) - (a.currentValue ?? -Infinity))[0];
  const dangerColor = LEVEL_COLOR["심각"];

  const now = new Date();
  const ts = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="p-2.5 pb-0">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-lg font-semibold text-carbon">
          <span className="inline-block h-3.5 w-3.5 rounded-full bg-electric" />
          관측소 예보 현황
        </div>
        <span className="text-xs text-silver">총 {total}개소</span>
      </div>

      {/* 최고 위험 카드 — 심각(5단계) 호기가 있을 때만 표시, 없으면 '없음' */}
      {worst ? (
        <div
          className="mb-1.5 flex items-center justify-between rounded-card border-l-4 px-3 py-2"
          style={{ borderColor: dangerColor, backgroundColor: LEVEL_TINT["심각"] }}
        >
          <div className="min-w-0">
            <div className="text-sm font-semibold" style={{ color: dangerColor }}>최고 위험 · 심각</div>
            <div className="mt-0.5 truncate text-lg font-bold text-carbon">{worst.unitName}</div>
          </div>
          <div className="ml-2 shrink-0 text-right">
            <div className="text-2xl font-extrabold leading-none" style={{ color: dangerColor }}>
              {worst.currentValue != null ? worst.currentValue.toFixed(1) : "-"}
              <span className="ml-0.5 text-sm font-semibold">℃</span>
            </div>
            <div className="mt-1 text-xs text-silver">{ts}</div>
          </div>
        </div>
      ) : (
        <div
          className="mb-1.5 flex items-center gap-2 rounded-card border-l-4 px-3 py-2.5"
          style={{ borderColor: "#11A37F", backgroundColor: "#E6F6F1" }}
        >
          <span className="text-lg font-bold" style={{ color: "#11A37F" }}>✓</span>
          <div>
            <div className="text-sm font-semibold" style={{ color: "#11A37F" }}>최고 위험 없음</div>
            <div className="text-sm font-medium text-graphite">현재 심각 단계 발전소 없음</div>
          </div>
        </div>
      )}

      {/* 단계별 개수 (1단계 여유 제외) */}
      <div className="grid grid-cols-2 gap-1.5">
        {counts.map((c) => (
          <div
            key={c.level}
            className="flex items-center justify-between rounded-card px-3 py-1.5"
            style={{ backgroundColor: LEVEL_TINT[c.level] }}
          >
            <div className="flex items-center gap-1.5 text-sm font-semibold text-carbon">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: LEVEL_COLOR[c.level] }} />
              {c.level}
            </div>
            <div className="text-xl font-bold text-carbon">{c.n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
