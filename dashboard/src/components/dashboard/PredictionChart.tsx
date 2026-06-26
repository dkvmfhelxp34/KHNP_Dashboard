// 실측 6시간 + 예측 6시간 라인차트 (Recharts).
// - 실측선(검정): 과거 관측. 예측선(초록): base_time 부터 미래.
// - 이전예측선(회색 점선): 실측 구간에 '그 시각 직전 최신 예측'을 겹쳐 비교.
// - 'base_time(현재)' 경계에 세로 기준선.
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { PredictionPoint } from "../../types";

export default function PredictionChart({ points }: { points: PredictionPoint[] }) {
  const data = points.map((p) => ({
    time: p.targetTime.slice(11, 16), // HH:MM
    실측: p.observedValue ?? null,
    예측: p.predictedValue ?? null,
    이전예측: p.priorPredictedValue ?? null,
  }));

  // base_time(현재) 경계: 실측·예측이 모두 있는 연결점
  const baseLabel = points.find(
    (p) => p.observedValue != null && p.predictedValue != null,
  )?.targetTime.slice(11, 16);

  // Y축 도메인: 모든 값(실측/예측/이전예측) 기준, 최소 5°C 범위 + 여유
  const MIN_SPAN = 5;
  const obs = points.map((p) => p.observedValue).filter((v): v is number => v != null);
  const all = points
    .flatMap((p) => [p.predictedValue, p.observedValue, p.priorPredictedValue])
    .filter((v): v is number => v != null && !Number.isNaN(v));
  const center = obs.length
    ? (Math.min(...obs) + Math.max(...obs)) / 2
    : all.length ? (Math.min(...all) + Math.max(...all)) / 2 : 20;
  const dataHalf = all.length ? (Math.max(...all) - Math.min(...all)) / 2 : 0;
  const half = Math.max(MIN_SPAN / 2, dataHalf + 0.5);
  const rawLo = center - half;
  const rawHi = center + half;

  // Y축 눈금: '나이스' 등간격(0.5 또는 정수 단위) → 도메인 끝을 눈금에 맞춰 간격 균일
  const rawStep = (rawHi - rawLo) / 5;
  const niceStep = rawStep <= 0.5 ? 0.5 : rawStep <= 1 ? 1 : Math.ceil(rawStep * 2) / 2;
  const lo = Math.floor(rawLo / niceStep) * niceStep;
  const hi = Math.ceil(rawHi / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += niceStep) ticks.push(Math.round(v * 100) / 100);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
        <XAxis dataKey="time" tick={{ fontSize: 12, fill: "#5C5E62" }} stroke="#D0D1D2" />
        <YAxis
          tick={{ fontSize: 12, fill: "#5C5E62" }}
          stroke="#D0D1D2"
          unit="°C"
          domain={[lo, hi]}
          ticks={ticks}
          interval={0}
        />
        <Tooltip
          formatter={((v: number) => `${v?.toFixed?.(2) ?? v}°C`) as never}
          contentStyle={{
            border: "1px solid #EEEEEE",
            borderRadius: 4,
            boxShadow: "none",
            fontSize: 12,
            color: "#393C41",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#5C5E62" }} />

        {/* base_time(현재) 경계선 — 좌측 실측 6시간 / 우측 예측 6시간 */}
        {baseLabel && (
          <ReferenceLine
            x={baseLabel}
            stroke="#0B5CAB"
            strokeDasharray="4 3"
            label={{ value: "현재", position: "top", fill: "#0B5CAB", fontSize: 11 }}
          />
        )}

        {/* 이전 예측(회색 점선) — 실측 구간 비교용 */}
        <Line
          type="monotone"
          dataKey="이전예측"
          stroke="#9CA3AF"
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={{ r: 2.5, fill: "#9CA3AF", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          connectNulls
        />
        {/* 실측(검정) → 예측(초록) */}
        <Line
          type="monotone"
          dataKey="실측"
          stroke="#171a20"
          strokeWidth={2}
          dot={{ r: 3, fill: "#171a20", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="예측"
          stroke="#11A37F"
          strokeWidth={2}
          dot={{ r: 3, fill: "#11A37F", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
