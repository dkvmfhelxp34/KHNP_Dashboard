// 백엔드 없이 데모용 mock 데이터 (실 API 응답 형태와 동일)
import type {
  Site, Unit, PredictionResponse, Alert,
  UnitSummary, SourcesResponse, ForecastLevel,
} from "../types";

const round = (v: number) => Math.round(v * 100) / 100;

export const mockSites: Site[] = [
  { siteId: "kori", siteName: "고리 원자력발전소", region: "부산광역시 기장군", latitude: 35.319904, longitude: 129.290053, status: "offline", unitCount: 0, predictionAvailable: false, lastUpdatedAt: new Date().toISOString() },
  { siteId: "saeul", siteName: "새울 원자력발전소", region: "울산광역시 울주군", latitude: 35.322904, longitude: 129.293053, status: "offline", unitCount: 0, predictionAvailable: false, lastUpdatedAt: new Date().toISOString() },
  { siteId: "wolsong", siteName: "월성 원자력발전소", region: "경상북도 경주시", latitude: 35.71667, longitude: 129.47778, status: "normal", unitCount: 5, predictionAvailable: true, lastUpdatedAt: new Date().toISOString() },
  { siteId: "hanbit", siteName: "한빛 원자력발전소", region: "전라남도 영광군", latitude: 35.415, longitude: 126.42389, status: "offline", unitCount: 0, predictionAvailable: false, lastUpdatedAt: new Date().toISOString() },
  { siteId: "hanul", siteName: "한울 원자력발전소", region: "경상북도 울진군", latitude: 37.09278, longitude: 129.38361, status: "offline", unitCount: 0, predictionAvailable: false, lastUpdatedAt: new Date().toISOString() },
];

const baseTemp: Record<string, number> = { sws1: 17.5, sws2: 17.8, ws2: 18.2, ws3: 17.9, ws4: 18.0 };

export const mockUnits: Record<string, Unit[]> = {
  wolsong: [
    { unitId: "sws1", unitName: "신월성1호기", siteId: "wolsong", status: "normal", predictionAvailable: true, source: "mock", lastUpdatedAt: new Date().toISOString() },
    { unitId: "sws2", unitName: "신월성2호기", siteId: "wolsong", status: "normal", predictionAvailable: true, source: "mock", lastUpdatedAt: new Date().toISOString() },
    { unitId: "ws2", unitName: "월성2호기", siteId: "wolsong", status: "warning", predictionAvailable: true, source: "mock", lastUpdatedAt: new Date().toISOString() },
    { unitId: "ws3", unitName: "월성3호기", siteId: "wolsong", status: "normal", predictionAvailable: true, source: "mock", lastUpdatedAt: new Date().toISOString() },
    { unitId: "ws4", unitName: "월성4호기", siteId: "wolsong", status: "normal", predictionAvailable: true, source: "mock", lastUpdatedAt: new Date().toISOString() },
  ],
};

export function findUnit(unitId: string): Unit | undefined {
  return Object.values(mockUnits).flat().find((u) => u.unitId === unitId);
}

export function mockPredictions(unitId: string): PredictionResponse {
  const base = new Date();
  base.setSeconds(0, 0);
  const cur = (baseTemp[unitId] ?? 18) + (Math.random() - 0.5);
  const predictions = Array.from({ length: 12 }, (_, i) => {
    const tt = new Date(base.getTime() + (i + 1) * 30 * 60000);
    return {
      targetTime: tt.toISOString(),
      predictedValue: Math.round((cur + 0.6 * Math.sin(i / 3) + (Math.random() - 0.5) * 0.3) * 1000) / 1000,
      observedValue: null,
    };
  });
  return { status: "ok", unitId, baseTime: base.toISOString(), currentValue: Math.round(cur * 1000) / 1000, source: "mock", predictions };
}

// 종합현황/현황판용 요약 (월성단지 5호기만 실데이터, 나머지는 백엔드에서 미제공)
export function mockSummary(): UnitSummary[] {
  const defs: { unitId: string; unitName: string; limit: number | null; trend: "up" | "down" | "flat" }[] = [
    { unitId: "ws2", unitName: "월성2호기", limit: null, trend: "up" },
    { unitId: "ws3", unitName: "월성3호기", limit: null, trend: "flat" },
    { unitId: "ws4", unitName: "월성4호기", limit: null, trend: "down" },
    { unitId: "sws1", unitName: "신월성1호기", limit: 31.5, trend: "up" },
    { unitId: "sws2", unitName: "신월성2호기", limit: 31.5, trend: "flat" },
  ];
  return defs.map((d) => {
    const cur = baseTemp[d.unitId] ?? 18;
    const level: ForecastLevel = d.limit == null ? "없음" : cur >= d.limit - 4 ? "관심" : "여유";
    return {
      unitId: d.unitId, unitName: d.unitName, siteId: "wolsong", status: "ok",
      currentValue: round(cur), baseObserved: round(cur - 0.1),
      p30: round(cur + 0.3), p60: round(cur + 0.5),
      trend: d.trend, rate: 0.02, level, limit: d.limit,
    };
  });
}

export function mockSources(): SourcesResponse {
  const now = new Date().toISOString();
  return {
    khnp: { connected: true, latest: now },
    jma: { connected: true, latest: now },
    hycom: { connected: true, latest: now },
  };
}

export function mockAlerts(unitId: string): Alert[] {
  return findUnit(unitId)?.status === "warning"
    ? [{ alertId: `${unitId}-w1`, unitId, level: "warning", message: "예측 수온이 주의 기준에 근접했습니다.", createdAt: new Date().toISOString() }]
    : [];
}
