// 도메인 타입 정의 (발전소 → 호기 → 예측 2단계 계층)

export type UnitStatus = "normal" | "warning" | "danger" | "offline";

// 발전소 단지 (지도 마커 단위)
export interface Site {
  siteId: string;
  siteName: string;
  region: string;
  latitude: number;
  longitude: number;
  status: UnitStatus;
  unitCount: number;
  predictionAvailable: boolean;
  lastUpdatedAt: string;
}

// 호기 (예측 대상)
export interface Unit {
  unitId: string;
  unitName: string;
  siteId: string;
  status: UnitStatus;
  predictionAvailable: boolean;
  source: "model" | "mock";
  lastUpdatedAt: string;
}

export interface SiteDetail extends Site {
  units: Unit[];
}

// 시계열 1점. 관측 history 구간은 predictedValue=null, 미래 예측 구간은 observedValue=null.
export interface PredictionPoint {
  targetTime: string;
  predictedValue: number | null;
  observedValue?: number | null;
  priorPredictedValue?: number | null;  // 실측 구간 '이전 예측'(그 시각 직전 최신 forecast) — 회색 비교선
  lowerBound?: number | null;
  upperBound?: number | null;
  confidence?: number | null;
}

export interface PredictionResponse {
  status: string; // ok | no_data | model_error
  unitId: string;
  baseTime?: string;
  currentValue?: number | null;     // DB 최신 수집(상태카드 '현재 수온', 라이브)
  baseObserved?: number | null;     // 예측 입력의 마지막 관측(base_time) — '마지막 관측수온'/추세 기준
  source?: string;
  predictions: PredictionPoint[];
  detail?: string;
  reason?: string; // no_data 사유 (취수구/JMA/HYCOM 미수신 등)
}

export interface Alert {
  alertId: string;
  unitId: string;
  level: "info" | "warning" | "critical";
  message: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  role: "admin" | "user";
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  role: "admin" | "user";
  approved: boolean;
}

// 예보 단계(제한치 대비). "없음"=제한치 미설정. 색상은 utils/status LEVEL_COLOR.
export type ForecastLevel = "여유" | "관심" | "주의" | "경보" | "심각" | "없음";

export interface UnitSummary {
  unitId: string;
  unitName: string;
  siteId: string;
  status: string;
  currentValue: number | null;
  baseObserved: number | null;   // 예측 입력의 마지막 관측(base_time) — '마지막 관측수온' 표시값
  p30: number | null;
  p60: number | null;
  peak: number | null;   // 예보 최고온도(6시간 예측 중 최댓값)
  trend: "up" | "down" | "flat";
  rate: number | null;   // 상승률 ℃/30분 평균(6시간 기준) — 그래프 상세와 동일 산식
  level: ForecastLevel;
  limit: number | null;
}

export interface SourceStatus {
  connected: boolean;
  latest: string | null;
}

export interface SourcesResponse {
  khnp: SourceStatus;
  jma: SourceStatus;
  hycom: SourceStatus;
}
