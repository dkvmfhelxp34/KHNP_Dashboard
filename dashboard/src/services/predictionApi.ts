import { apiClient } from "./apiClient";
import type { PredictionResponse } from "../types";

// 예측 fetch (호기별 12-step). polling/WebSocket 전환 시 이 함수만 교체하면 됨.
export async function fetchPredictions(unitId: string): Promise<PredictionResponse> {
  const { data } = await apiClient.get<PredictionResponse>(`/units/${unitId}/predictions`);
  return data;
}

export async function fetchRealtime(unitId: string) {
  const { data } = await apiClient.get(`/units/${unitId}/realtime`);
  return data;
}
