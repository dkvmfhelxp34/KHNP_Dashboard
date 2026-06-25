// 좌측 사이드바 상단 '현황판' — 전 본부 호기를 아이콘 타일로 한눈에.
// 타일 클릭 → 시계열 팝업(onSelectUnit). 실모델 호기(id 보유)만 클릭 가능.
import type { UnitSummary } from "../../types";
import { LEVEL_COLOR } from "../../utils/status";
import { ORG, LEGEND, type Cell } from "../../data/orgUnits";

// 호기 한 기를 나타내는 작은 원자로(냉각탑) 아이콘. 색 = 상태/단계색.
function ReactorIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="24" viewBox="0 0 40 48" aria-hidden="true">
      <g fill={color}>
        <path d="M12 4.5 H28 L26.4 9 H13.6 Z" />
        <path d="M13.6 9 H26.4 C24.6 20 27 31 30 40 H10 C13 31 15.4 20 13.6 9 Z" />
        <rect x="9" y="41.4" width="22" height="2.6" />
      </g>
      <g transform="translate(20 27)">
        <circle r="7.4" fill="#ffffff" />
        <circle r="2" fill={color} />
      </g>
    </svg>
  );
}

// 타일 짧은 라벨: "신월성1호기" → "신월성1"
const shortName = (name: string) => name.replace("호기", "");

function UnitTile({
  cell,
  summary,
  selected,
  onSelect,
}: {
  cell: Cell;
  summary?: UnitSummary;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const ok = summary && summary.status === "ok";
  const clickable = !!cell.id;
  // 아이콘 색 = 예보(단계) 색과 일치. 데이터 없으면(개발예정/데이터없음) 옅은 회색.
  const color = ok ? LEVEL_COLOR[summary!.level] : "#c8c9cb";

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => cell.id && onSelect(cell.id)}
      title={cell.id ? `${cell.name} · 클릭하면 시계열 보기` : `${cell.name} · 개발 예정`}
      className={`flex flex-col items-center gap-0.5 rounded-tesla border px-0.5 py-1 text-center transition ${
        selected
          ? "border-electric bg-sky"
          : clickable
            ? "border-cloud hover:border-electric hover:bg-ash"
            : "border-cloud/60 opacity-55"
      } ${clickable ? "cursor-pointer" : "cursor-default"}`}
    >
      <ReactorIcon color={color} />
      <span className="w-full truncate text-sm leading-tight text-carbon">{shortName(cell.name)}</span>
    </button>
  );
}

export default function StatusPanel({
  summary,
  selectedUnitId,
  onSelectUnit,
}: {
  summary: UnitSummary[];
  selectedUnitId: string | null;
  onSelectUnit: (id: string) => void;
}) {
  const byId = new Map(summary.map((s) => [s.unitId, s]));

  return (
    <div className="p-2.5 pt-6">
      <div className="mb-1.5 flex items-center gap-2 px-1 text-lg font-semibold text-carbon">
        <span className="inline-block h-3.5 w-3.5 rounded-full bg-electric" />
        현황판
        <span className="ml-auto text-xs font-normal text-silver">호기별 실시간</span>
      </div>

      {/* 예보 단계 색상 범례 (1~5단계) */}
      <div className="mb-2 flex flex-wrap gap-x-2.5 gap-y-1 px-1">
        {LEGEND.map((l) => (
          <span key={l.step} className="inline-flex items-center gap-1 text-xs text-graphite">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLOR[l.level] }} />
            {l.step}
          </span>
        ))}
      </div>

      {/* 본부별로 카드(헤더+테두리)로 구분 */}
      <div className="space-y-2">
        {ORG.map((g) => (
          <div key={g.hq} className="overflow-hidden rounded-card border border-cloud">
            <div className="bg-sky px-2 py-1 text-sm font-semibold text-electric">{g.hq}본부</div>
            <div className="grid grid-cols-6 gap-1 p-1.5">
              {g.units.map((u) => (
                <UnitTile
                  key={u.name}
                  cell={u}
                  summary={u.id ? byId.get(u.id) : undefined}
                  selected={!!u.id && u.id === selectedUnitId}
                  onSelect={onSelectUnit}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
