// 본부 → 호기 구성과 예보 단계 범례. 종합현황·현황판 패널이 공용으로 사용.
// id = 실모델 unitId(월성단지만 존재). limit = 설계해수온도(제한치, null=없음).
// 제한치 원본: scr/json_folder/design_seatemp_limits.json 과 동일.
import type { ForecastLevel } from "../types";

export type Cell = { name: string; id?: string; limit: number | null };

export const ORG: { hq: string; units: Cell[] }[] = [
  { hq: "고리", units: [
    { name: "고리2호기", limit: 36.1 }, { name: "고리3호기", limit: 33.3 }, { name: "고리4호기", limit: 33.3 },
    { name: "신고리1호기", limit: 32.9 }, { name: "신고리2호기", limit: 32.9 }] },
  { hq: "새울", units: [
    { name: "새울1호기", limit: 34.9 }, { name: "새울2호기", limit: 34.9 },
    { name: "새울3호기", limit: 34.9 }, { name: "새울4호기", limit: 34.9 }] },
  { hq: "월성", units: [
    { name: "월성2호기", id: "ws2", limit: null }, { name: "월성3호기", id: "ws3", limit: null },
    { name: "월성4호기", id: "ws4", limit: null },
    { name: "신월성1호기", id: "sws1", limit: 31.5 }, { name: "신월성2호기", id: "sws2", limit: 31.5 }] },
  { hq: "한빛", units: [
    { name: "한빛1호기", limit: 36.0 }, { name: "한빛2호기", limit: 36.0 }, { name: "한빛3호기", limit: 35.5 },
    { name: "한빛4호기", limit: 35.5 }, { name: "한빛5호기", limit: 35.5 }, { name: "한빛6호기", limit: 35.5 }] },
  { hq: "한울", units: [
    { name: "한울1호기", limit: 31.6 }, { name: "한울2호기", limit: 31.6 }, { name: "한울3호기", limit: 31.5 },
    { name: "한울4호기", limit: 31.5 }, { name: "한울5호기", limit: 32.4 }, { name: "한울6호기", limit: 32.4 },
    { name: "신한울1호기", limit: 31.0 }, { name: "신한울2호기", limit: 31.0 }] },
];

export const LEGEND: { step: string; level: ForecastLevel; limit: string }[] = [
  { step: "1단계", level: "여유", limit: "-" },
  { step: "2단계", level: "관심", limit: "제한치 -4℃" },
  { step: "3단계", level: "주의", limit: "제한치 -3℃" },
  { step: "4단계", level: "경보", limit: "제한치 -2℃" },
  { step: "5단계", level: "심각", limit: "제한치 이상" },
];

// 표시용 포매터(여러 컴포넌트 공용)
export const fmt = (v: number | null | undefined) => (v == null ? "-" : v.toFixed(2));
export const fmtLimit = (v: number | null) => (v == null ? "없음" : `${v.toFixed(1)}℃`);
