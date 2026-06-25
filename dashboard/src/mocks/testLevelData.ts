// 테스트 전용 임의 데이터: 예보 1~5단계(여유·관심·주의·경보·심각)를 모두 표출.
// /test/levels 페이지에서만 사용. 실제 DB 연동 대시보드(/dashboard)와 무관.
import type { UnitSummary, ForecastLevel } from "../types";

const mk = (
  unitId: string,
  unitName: string,
  level: ForecastLevel,
  currentValue: number,
  limit: number,
): UnitSummary => ({
  unitId, unitName, siteId: "wolsong", status: "ok",
  currentValue, baseObserved: currentValue - 0.2,
  p30: currentValue + 0.3, p60: currentValue + 0.6,
  peak: currentValue + 0.8,
  trend: "up", rate: 0.05, level, limit,
});

// 월성단지 5호기에 각각 다른 단계를 부여해 1~5단계를 한 화면에 표출
export const testLevelSummary: UnitSummary[] = [
  mk("ws2", "월성2호기", "여유", 18.0, 31.5),
  mk("ws3", "월성3호기", "관심", 27.6, 31.5),
  mk("ws4", "월성4호기", "주의", 28.6, 31.5),
  mk("sws1", "신월성1호기", "경보", 29.6, 31.5),
  mk("sws2", "신월성2호기", "심각", 31.8, 31.5),
];
