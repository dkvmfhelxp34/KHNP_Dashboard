import type { UnitStatus, ForecastLevel } from "../types";

// 예보 단계 색상 (1단계 여유 ~ 5단계 심각). 종합현황표·추세 색상 공통.
export const LEVEL_COLOR: Record<ForecastLevel, string> = {
  여유: "#16a34a",
  관심: "#2563eb",
  주의: "#fce300",
  경보: "#f59e0b",
  심각: "#dc2626",
  없음: "#9ca3af",
};

// 상태별 색상/라벨 (지도 마커·카드 공통)
export const STATUS_COLOR: Record<UnitStatus, string> = {
  normal: "#16a34a",
  warning: "#eab308",
  danger: "#dc2626",
  offline: "#9ca3af",
};

export const STATUS_LABEL: Record<UnitStatus, string> = {
  normal: "정상",
  warning: "주의",
  danger: "경고",
  offline: "개발 예정",
};

export function statusBadgeClass(status: UnitStatus): string {
  const map: Record<UnitStatus, string> = {
    normal: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    danger: "bg-red-100 text-red-800",
    offline: "bg-gray-100 text-gray-600",
  };
  return map[status];
}
