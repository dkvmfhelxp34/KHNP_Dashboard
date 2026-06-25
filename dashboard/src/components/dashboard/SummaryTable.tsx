// 지도 하단 종합 현황표. 전 발전소 호기 + 제한치(설계해수온도). 월성만 실모델, 나머지는 '개발 예정'.
import { useNavigate } from "react-router-dom";
import type { UnitSummary, ForecastLevel } from "../../types";
import { LEVEL_COLOR } from "../../utils/status";

// 본부 → 호기. id = 실모델 unitId(월성단지만). limit = 설계해수온도(제한치, null=없음).
// 제한치 원본: scr/json_folder/design_seatemp_limits.json 과 동일.
type Cell = { name: string; id?: string; limit: number | null };
const ORG: { hq: string; units: Cell[] }[] = [
  { hq: "고리", units: [
    { name: "고리2호기", limit: 36.1 }, { name: "고리3호기", limit: 33.3 }, { name: "고리4호기", limit: 33.3 },
    { name: "신고리1호기", limit: 32.9 }, { name: "신고리2호기", limit: 32.9 }] },
  { hq: "새울", units: [
    { name: "새울1호기", limit: 34.9 }, { name: "새울2호기", limit: 34.9 },
    { name: "새울3호기", limit: 34.9 }, { name: "새울4호기", limit: 34.9 }] },
  { hq: "월성", units: [
    { name: "월성2호기", id: "ws2", limit: null }, { name: "월성3호기", id: "ws3", limit: null },
    { name: "월성4호기", id: "ws4", limit: null },
    { name: "신월성1호기", id: "sws1", limit: 31.5 }, { name: "신월성2호기", id: "sws2", limit: 31.5 }] },
  { hq: "한빛", units: [
    { name: "한빛1호기", limit: 36.0 }, { name: "한빛2호기", limit: 36.0 }, { name: "한빛3호기", limit: 35.5 },
    { name: "한빛4호기", limit: 35.5 }, { name: "한빛5호기", limit: 35.5 }, { name: "한빛6호기", limit: 35.5 }] },
  { hq: "한울", units: [
    { name: "한울1호기", limit: 31.6 }, { name: "한울2호기", limit: 31.6 }, { name: "한울3호기", limit: 31.5 },
    { name: "한울4호기", limit: 31.5 }, { name: "한울5호기", limit: 32.4 }, { name: "한울6호기", limit: 32.4 },
    { name: "신한울1호기", limit: 31.0 }, { name: "신한울2호기", limit: 31.0 }] },
];

const LEGEND: { step: string; level: ForecastLevel; limit: string }[] = [
  { step: "1단계", level: "여유", limit: "-" },
  { step: "2단계", level: "관심", limit: "제한치 -4℃" },
  { step: "3단계", level: "주의", limit: "제한치 -3℃" },
  { step: "4단계", level: "경보", limit: "제한치 -2℃" },
  { step: "5단계", level: "심각", limit: "제한치 이상" },
];

function Trend({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <span className="text-red-600">▲</span>;
  if (trend === "down") return <span className="text-blue-600">▼</span>;
  return <span className="text-carbon">■</span>;
}

const fmt = (v: number | null | undefined) => (v == null ? "-" : v.toFixed(2));
const fmtLimit = (v: number | null) => (v == null ? "없음" : `${v.toFixed(1)}℃`);

function OrgBlock({ groups, byId }: { groups: typeof ORG; byId: Map<string, UnitSummary> }) {
  const navigate = useNavigate();
  return (
    <table className="w-full border-collapse text-center text-sm [&_td]:whitespace-nowrap">
      <thead>
        <tr className="bg-ash text-pewter">
          <th className="border border-cloud px-1 py-1 font-medium">본부</th>
          <th className="border border-cloud px-1 py-1 font-medium whitespace-nowrap" style={{ width: "4.5rem" }}>호기</th>
          <th className="border border-cloud px-1 py-1 font-medium">예보</th>
          <th className="border border-cloud px-1 py-1 font-medium">제한치</th>
          <th className="border border-cloud px-1 py-1 font-medium whitespace-nowrap" style={{ width: "13rem" }}>현재 수온 (1분 간격)</th>
          <th className="border border-cloud px-1 py-1 font-medium whitespace-nowrap" style={{ width: "13rem" }}>마지막 관측수온 (30분 간격)</th>
          <th className="border border-cloud px-1 py-1 font-medium">+30분</th>
          <th className="border border-cloud px-1 py-1 font-medium">+60분</th>
          <th className="border border-cloud px-1 py-1 font-medium">추세</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) =>
          g.units.map((u, i) => {
            const s = u.id ? byId.get(u.id) : undefined;
            const ok = s && s.status === "ok";
            const clickable = !!u.id;
            return (
              <tr
                key={g.hq + u.name}
                className={clickable ? "cursor-pointer hover:bg-ash" : ""}
                onClick={clickable ? () => navigate(`/dashboard/units/${u.id}`) : undefined}
              >
                {i === 0 && (
                  <td rowSpan={g.units.length} className="border border-cloud px-1 py-1 font-medium text-carbon">
                    {g.hq}
                  </td>
                )}
                <td className="border border-cloud px-1 py-1 text-carbon">{u.name}</td>

                {/* 예보(단계) — 제한치 있고 예측 정상일 때만 색상 점 */}
                <td className="border border-cloud px-1 py-1">
                  {ok && s!.level !== "없음" ? (
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: LEVEL_COLOR[s!.level] }}
                      title={s!.level}
                    />
                  ) : (
                    <span className="text-silver">-</span>
                  )}
                </td>

                {/* 제한치(설계해수온도) — 모든 호기 표시 */}
                <td className="border border-cloud px-1 py-1 text-graphite">{fmtLimit(u.limit)}</td>

                {ok ? (
                  <>
                    <td className="border border-cloud px-1 py-1 text-carbon">{fmt(s!.currentValue)}</td>
                    <td className="border border-cloud px-1 py-1 text-carbon">{fmt(s!.baseObserved)}</td>
                    <td className="border border-cloud px-1 py-1 text-graphite">{fmt(s!.p30)}</td>
                    <td className="border border-cloud px-1 py-1 text-graphite">{fmt(s!.p60)}</td>
                    <td className="border border-cloud px-1 py-1"><Trend trend={s!.trend} /></td>
                  </>
                ) : (
                  <td colSpan={5} className="border border-cloud px-1 py-1 text-silver">
                    {u.id ? "데이터 없음" : "개발 예정"}
                  </td>
                )}
              </tr>
            );
          }),
        )}
      </tbody>
    </table>
  );
}

export default function SummaryTable({ summary }: { summary: UnitSummary[] }) {
  const byId = new Map(summary.map((s) => [s.unitId, s]));
  const now = new Date();
  const nowText = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="border-t-2 border-pale bg-white px-4 pt-2 pb-3">
      <div className="mb-2 flex items-end justify-between">
        <div className="flex items-center gap-2 text-base font-medium text-carbon">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-electric" /> 종합 현황
        </div>
        <div className="text-xs text-pewter">현재 시간: {nowText}</div>
      </div>

      {/* 단계 범례 */}
      <div className="mb-2 flex flex-wrap gap-2">
        {LEGEND.map((l) => (
          <div key={l.step} className="flex items-center gap-1.5 rounded-tesla border border-cloud px-1 py-1 text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLOR[l.level] }} />
            <span className="text-pewter">{l.step}</span>
            <span className="text-carbon">{l.level}</span>
            <span className="text-silver">{l.limit}</span>
          </div>
        ))}
      </div>

      {/* 좌(고리·새울·월성) / 우(한빛·한울) 2블록 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OrgBlock groups={ORG.slice(0, 3)} byId={byId} />
        <OrgBlock groups={ORG.slice(3)} byId={byId} />
      </div>
    </div>
  );
}
