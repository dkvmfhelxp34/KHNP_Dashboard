// 관측 history + 12-step 미래 예측 라인차트 (Recharts).
// 관측선은 과거, 예측선은 base_time 부터 미래 — 두 선이 base_time 에서 연결된다.
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { PredictionPoint } from "../../types";

export default function PredictionChart({ points }: { points: PredictionPoint[] }) {
  const data = points.map((p) => ({
    time: p.targetTime.slice(11, 16), // HH:MM
    예측: p.predictedValue ?? null,
    실측: p.observedValue ?? null,
  }));

  // Y축: 관측값(있으면)을 중심으로, 최소 5°C 범위가 보이도록 위아래 확장
  const MIN_SPAN = 5;
  const obs = points.map((p) => p.observedValue).filter((v): v is number => v != null);
  const all = points
    .flatMap((p) => [p.predictedValue, p.observedValue])
    .filter((v): v is number => v != null && !Number.isNaN(v));
  const center = obs.length
    ? (Math.min(...obs) + Math.max(...obs)) / 2
    : (Math.min(...all) + Math.max(...all)) / 2;
  const dataHalf = all.length ? (Math.max(...all) - Math.min(...all)) / 2 : 0;
  const half = Math.max(MIN_SPAN / 2, dataHalf + 0.5); // 데이터 범위 + 여유, 최소 ±2.5
  const domain: [number, number] = [
    Math.floor((center - half) * 10) / 10,
    Math.ceil((center + half) * 10) / 10,
  ];
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
        {/* Tesla 톤: 연한 cloud 그리드, Electric Blue 예측선, graphite 관측선 */}
        <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
        <XAxis dataKey="time" tick={{ fontSize: 12, fill: "#5C5E62" }} stroke="#D0D1D2" />
        <YAxis
          tick={{ fontSize: 12, fill: "#5C5E62" }}
          stroke="#D0D1D2"
          unit="°C"
          domain={domain}
          allowDecimals
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
        {/* -o- : 선 + 각 지점 원형 마커. 실측(검정, 과거) → base_time 연결 → 예측(초록, 미래) */}
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
          stroke="#16a34a"
          strokeWidth={2}
          dot={{ r: 3, fill: "#16a34a", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
