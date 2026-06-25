// 호기 상세: 상태카드(현재수온+소스 API 연결) + 관측·예측 차트 + +30~120 예측/추세. 10초 polling.
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "../components/layout/Header";
import StatusCard from "../components/dashboard/StatusCard";
import PredictionChart from "../components/dashboard/PredictionChart";
import { Loading, ErrorMessage, EmptyState } from "../components/common/Feedback";
import { fetchUnit, fetchSources } from "../services/unitApi";
import { fetchPredictions } from "../services/predictionApi";
import type { SourceStatus } from "../types";

const POLL_MS = 10000;

// 소스 API 연결 상태 박스: 연결 시 초록 + 약간 빛나는 둥근 네모
function ApiStatusCard({ label, src }: { label: string; src?: SourceStatus }) {
  const ok = !!src?.connected;
  return (
    <div
      className={`rounded-card border p-4 transition ${
        ok
          ? "border-green-400 bg-green-50 shadow-[0_0_12px_rgba(34,197,94,0.45)]"
          : "border-cloud bg-white"
      }`}
    >
      <div className="text-xs text-pewter">{label}</div>
      <div className={`mt-1.5 flex items-center gap-1.5 text-sm font-medium ${ok ? "text-green-600" : "text-silver"}`}>
        <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-green-500" : "bg-gray-300"}`} />
        {ok ? "정상 연결" : "미연결"}
      </div>
    </div>
  );
}

export default function UnitDetailPage() {
  const { unitId = "" } = useParams();
  const navigate = useNavigate();

  const unitQ = useQuery({ queryKey: ["unit", unitId], queryFn: () => fetchUnit(unitId) });
  const predQ = useQuery({
    queryKey: ["pred", unitId],
    queryFn: () => fetchPredictions(unitId),
    refetchInterval: POLL_MS,
  });
  const sourcesQ = useQuery({ queryKey: ["sources"], queryFn: fetchSources, refetchInterval: POLL_MS });

  const pred = predQ.data;
  const points = pred?.predictions ?? [];
  const future = points.filter((p) => p.observedValue == null && p.predictedValue != null);
  const observed = points.filter((p) => p.observedValue != null);
  const obsTail = observed.slice(-future.length);
  const rows = future.map((f, i) => ({ obs: obsTail[i], pred: f }));

  const cur = pred?.currentValue ?? null;          // DB 최신 수집(상태카드 '현재 수온')
  const baseObs = pred?.baseObserved ?? null;      // 예측 입력의 마지막 관측(base_time) — '마지막 관측수온'/추세 기준
  const fv = (i: number) => future[i]?.predictedValue ?? null;
  // 예측값 색: 예측 입력 마지막관측보다 높으면 빨강, 낮으면 파랑, 같음/불가는 검정
  const predCls = (v: number | null) =>
    v == null || baseObs == null ? "text-carbon" : v > baseObs ? "text-red-600" : v < baseObs ? "text-blue-700" : "text-carbon";
  // 추세(상승률): 가용 예측 마지막값과 '예측 입력 마지막관측'(baseObs) 차이를 30분 스텝당으로 환산
  let rate: number | null = null;
  if (baseObs != null && future.length) {
    const last = future[future.length - 1].predictedValue as number;
    rate = (last - baseObs) / future.length;
  }
  const rateText =
    rate == null ? "-" : `${rate > 0 ? "▲" : rate < 0 ? "▼" : "■"} (${rate.toFixed(4)}℃/30분)`;

  const src = sourcesQ.data;

  return (
    <div className="flex h-full flex-col bg-white">
      <Header />
      <div className="flex-1 overflow-y-auto p-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-4 text-sm text-electric hover:underline"
        >
          ← 지도로 돌아가기
        </button>

        {unitQ.isLoading && <Loading />}
        {unitQ.isError && <ErrorMessage message="호기 정보를 불러오지 못했습니다." />}

        {unitQ.data && (
          <>
            <h1 className="mb-5 text-2xl font-medium text-carbon">{unitQ.data.unitName}</h1>

            {pred?.status === "no_data" && (
              <div className="mb-5 rounded-card border border-cloud bg-ash p-4 text-sm text-graphite">
                <span className="font-medium text-status-danger">데이터 없음</span>
                {pred.reason ? ` — ${pred.reason}` : " — 실시간 예측 입력자료가 없습니다."}
              </div>
            )}

            {/* 상태 카드: 현재수온 + 소스 API 연결상태 */}
            <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatusCard label="현재 수온 (1분 간격)" value={cur ?? "-"} unit="℃" accent />
              <ApiStatusCard label="한수원 API" src={src?.khnp} />
              <ApiStatusCard label="JMA API" src={src?.jma} />
              <ApiStatusCard label="HYCOM API" src={src?.hycom} />
            </div>

            {/* 차트 */}
            <div className="mb-5 rounded-card border border-cloud bg-white p-5">
              <h2 className="mb-3 text-[13px] font-medium text-graphite">관측 + 6시간 예측</h2>
              {predQ.isLoading && <Loading />}
              {pred?.status === "model_error" && <ErrorMessage message={pred.detail ?? "추론 오류"} />}
              {points.length === 0 ? <EmptyState /> : <PredictionChart points={points} />}
            </div>

            {/* +30~120 예측 + 추세(상승률) 요약 (예시그림2) */}
            <div className="mb-5 overflow-hidden rounded-card border border-cloud">
              <table className="w-full text-center text-sm">
                <thead>
                  <tr className="bg-ash text-pewter">
                    <th className="px-3 py-2 font-medium">마지막 관측수온 (30분 간격)</th>
                    <th className="px-3 py-2 font-medium">+30분</th>
                    <th className="px-3 py-2 font-medium">+60분</th>
                    <th className="px-3 py-2 font-medium">+90분</th>
                    <th className="px-3 py-2 font-medium">+120분</th>
                    <th className="px-3 py-2 font-medium">추세 (상승률)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-cloud">
                    <td className="px-3 py-2 font-medium text-carbon">{baseObs != null ? `${baseObs.toFixed(2)}℃` : "-"}</td>
                    <td className={`px-3 py-2 ${predCls(fv(0))}`}>{fv(0) != null ? `${fv(0)!.toFixed(2)}℃` : "-"}</td>
                    <td className={`px-3 py-2 ${predCls(fv(1))}`}>{fv(1) != null ? `${fv(1)!.toFixed(2)}℃` : "-"}</td>
                    <td className={`px-3 py-2 ${predCls(fv(2))}`}>{fv(2) != null ? `${fv(2)!.toFixed(2)}℃` : "-"}</td>
                    <td className={`px-3 py-2 ${predCls(fv(3))}`}>{fv(3) != null ? `${fv(3)!.toFixed(2)}℃` : "-"}</td>
                    <td
                      className="px-3 py-2 font-medium"
                      style={{ color: rate == null ? "#1f2937" : rate > 0 ? "#dc2626" : rate < 0 ? "#2563eb" : "#1f2937" }}
                    >
                      {rateText}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 관측 ↔ 예측 상세표 */}
            <div className="rounded-card border border-cloud bg-white p-5">
              <h2 className="mb-3 text-[13px] font-medium text-graphite">예측 상세표</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-carbon">
                    <th className="py-1.5 font-normal">관측 일시</th>
                    <th className="font-normal">관측(℃)</th>
                    <th className="py-1.5 pl-3 font-normal">예측 일시</th>
                    <th className="font-normal">예측(℃)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ obs, pred: p }) => (
                    <tr key={p.targetTime} className="border-t border-cloud text-carbon">
                      <td className="py-1.5">{obs ? obs.targetTime.slice(0, 16).replace("T", " ") : "-"}</td>
                      <td>{obs?.observedValue != null ? obs.observedValue.toFixed(2) : "-"}</td>
                      <td className="py-1.5 pl-3">{p.targetTime.slice(0, 16).replace("T", " ")}</td>
                      <td className={predCls(p.predictedValue)}>{p.predictedValue?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-silver">
              마지막 업데이트: {unitQ.data.lastUpdatedAt?.slice(0, 19).replace("T", " ")} ·{" "}
              {POLL_MS / 1000}초마다 자동 갱신
            </p>
          </>
        )}
      </div>
    </div>
  );
}
