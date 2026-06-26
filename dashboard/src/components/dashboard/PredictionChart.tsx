// 실측 6시간 + 예측 6시간 라인차트 (Recharts).
// - 실측선(검정): 과거 관측. 예측선(초록): base_time 부터 미래.
// - 이전예측선(회색 점선): 실측 구간에 '그 시각 직전 최신 예측'을 겹쳐 비교.
// - 'base_time(현재)' 경계에 세로 기준선.
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { PredictionPoint } from "../../types";

export default function PredictionChart({ points }: { points: PredictionPoint[] }) {
  const data = points.map((p) => ({
    time: p.targetTime.slice(11, 16), // HH:MM
    실측: p.observedValue ?? null,
    예측: p.predictedValue ?? null,
    이전예측: p.priorPredictedValue ?? null,
  }));

  // Y축: 데이터 중심을 0.5℃ 단위로 맞추고 위·아래 1.5℃, 0.5℃ 간격 눈금(22.5·22.0…처럼 딱 떨어짐)
  const obs = points.map((p) => p.observedValue).filter((v): v is number => v != null);
  const all = points
    .flatMap((p) => [p.predictedValue, p.observedValue, p.priorPredictedValue])
    .filter((v): v is number => v != null && !Number.isNaN(v));
  const center = obs.length
    ? (Math.min(...obs) + Math.max(...obs)) / 2
    : all.length ? (Math.min(...all) + Math.max(...all)) / 2 : 20;
  const c = Math.round(center * 2) / 2;   // 0.5 단위로 반올림 → 눈금이 딱 떨어짐
  const lo = c - 1.5;
  const hi = c + 1.5;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += 0.5) ticks.push(Math.round(v * 10) / 10);

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
