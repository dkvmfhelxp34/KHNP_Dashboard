import type { UnitStatus, ForecastLevel } from "../types";

// 예보 단계 색상 (1단계 여유 ~ 5단계 심각). 참고 이미지 팔레트 기준.
export const LEVEL_COLOR: Record<ForecastLevel, string> = {
  여유: "#11A37F", // Secondary Green
  관심: "#2563EB", // Blue
  주의: "#EAB308", // Yellow
  경보: "#F59E0B", // Warning Orange
  심각: "#E53935", // Alert Red
  없음: "#9CA3AF",
};

// 상태별 색상/라벨 (지도 마커·카드 공통)
export const STATUS_COLOR: Record<UnitStatus, string> = {
  normal: "#11A37F",
  warning: "#F59E0B",
  danger: "#E53935",
  offline: "#9CA3AF",
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
