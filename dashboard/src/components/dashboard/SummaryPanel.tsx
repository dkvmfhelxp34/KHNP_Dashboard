// 우측 대형 '종합 현황' — 전 본부 호기를 세로로 크게. 실모델 호기 행 클릭 → 시계열 팝업.
import type { UnitSummary } from "../../types";
import { LEVEL_COLOR } from "../../utils/status";
import { ORG, LEGEND, fmt, fmtLimit } from "../../data/orgUnits";

function Trend({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <span className="text-red-600">▲</span>;
  if (trend === "down") return <span className="text-blue-600">▼</span>;
  return <span className="text-carbon">■</span>;
}

// 본부 1개 블록(세로 스택). onSelectUnit 으로 호기 시계열 팝업 호출.
function OrgBlock({
  group,
  byId,
  onSelectUnit,
}: {
  group: (typeof ORG)[number];
  byId: Map<string, UnitSummary>;
  onSelectUnit: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-cloud">
      <div className="bg-ash px-3 py-1.5 text-sm font-medium text-carbon">{group.hq}본부</div>
      <table className="w-full table-fixed border-collapse text-center text-sm [&_td]:whitespace-nowrap">
        {/* 모든 본부 블록이 동일한 열 너비를 갖도록 고정 */}
        <colgroup>
          <col className="w-[18%]" />
          <col className="w-[9%]" />
          <col className="w-[12%]" />
          <col className="w-[15%]" />
          <col className="w-[15%]" />
          <col className="w-[11%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead>
          <tr className="bg-white text-pewter">
            <th className="border-b border-cloud px-2 py-1.5 text-left font-medium">호기</th>
            <th className="border-b border-cloud px-2 py-1.5 font-medium">예보</th>
            <th className="border-b border-cloud px-2 py-1.5 font-medium">제한치</th>
            <th className="border-b border-cloud px-2 py-1.5 font-medium">현재수온<br /><span className="text-xs font-normal text-silver">1분</span></th>
            <th className="border-b border-cloud px-2 py-1.5 font-medium">마지막관측<br /><span className="text-xs font-normal text-silver">30분</span></th>
            <th className="border-b border-cloud px-2 py-1.5 font-medium">+30분</th>
            <th className="border-b border-cloud px-2 py-1.5 font-medium">+60분</th>
            <th className="border-b border-cloud px-2 py-1.5 font-medium">추세</th>
          </tr>
        </thead>
        <tbody>
          {group.units.map((u) => {
            const s = u.id ? byId.get(u.id) : undefined;
            const ok = s && s.status === "ok";
            const clickable = !!u.id;
            return (
              <tr
                key={u.name}
                className={`border-t border-cloud ${clickable ? "cursor-pointer hover:bg-ash" : ""}`}
                onClick={clickable ? () => onSelectUnit(u.id!) : undefined}
              >
                <td className="truncate px-2 py-1.5 text-left font-medium text-carbon">{u.name}</td>
                <td className="px-2 py-1.5">
                  {ok && s!.level !== "없음" ? (
                    <span
                      className="inline-block h-3 w-3 rounded-full align-middle"
                      style={{ backgroundColor: LEVEL_COLOR[s!.level] }}
                      title={s!.level}
                    />
                  ) : (
                    <span className="text-silver">-</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-graphite">{fmtLimit(u.limit)}</td>
                {ok ? (
                  <>
                    <td className="px-2 py-1.5 font-medium text-carbon">{fmt(s!.currentValue)}</td>
                    <td className="px-2 py-1.5 text-carbon">{fmt(s!.baseObserved)}</td>
                    <td className="px-2 py-1.5 text-graphite">{fmt(s!.p30)}</td>
                    <td className="px-2 py-1.5 text-graphite">{fmt(s!.p60)}</td>
                    <td className="px-2 py-1.5"><Trend trend={s!.trend} /></td>
                  </>
                ) : (
                  <td colSpan={5} className="px-2 py-1.5 text-silver">
                    {u.id ? "데이터 없음" : "개발 예정"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SummaryPanel({
  summary,
  onSelectUnit,
}: {
  summary: UnitSummary[];
  onSelectUnit: (id: string) => void;
}) {
  const byId = new Map(summary.map((s) => [s.unitId, s]));
  const now = new Date();
  const nowText = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div>
      {/* 헤더 + 현재시간 */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2 text-lg font-medium text-carbon">
          <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-electric" />
          종합 현황
        </div>
        <div className="text-xs text-pewter">현재 시간: {nowText}</div>
      </div>

      {/* 단계 범례 */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {LEGEND.map((l) => (
          <div key={l.step} className="flex items-center gap-1.5 rounded-tesla border border-cloud px-2 py-1 text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLOR[l.level] }} />
            <span className="text-pewter">{l.step}</span>
            <span className="text-carbon">{l.level}</span>
            <span className="text-silver">{l.limit}</span>
          </div>
        ))}
      </div>

      {/* 본부별 세로 스택 (크게) */}
      <div className="space-y-3">
        {ORG.map((g) => (
          <OrgBlock key={g.hq} group={g} byId={byId} onSelectUnit={onSelectUnit} />
        ))}
      </div>
    </div>
  );
}
