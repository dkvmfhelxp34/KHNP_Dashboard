"""호기별 12-step 수온 추론 어댑터 (5호기 일반화) + 예측 DB 적재/조회.

[2026-07-07] 모델 교체: 2-enc DeltaHorizonDecoderModel(2입력·delta)
             → ST3 IntakeST3EncoderModel(3입력·residual_last).
  - 입력: (intake 48) + (JMA 60×3) + (HYCOM 60×3), 소스별 분리 정규화.
  - 출력: 정규화 절대 intake → pred = pred_norm*intake_std + intake_mean (prev+ 없음).
  - 모델/통계: output/codex_khnp_model_test/st3_deploy/{unit}.pt, _workspace/p4_stats/{unit}_norm_stats.npz(ST3 포맷).
  - 대시보드 계약(그대로 보존): latest_observation, latest_prediction 의 baseObserved·priorPredictedValue,
    OBS_HISTORY=13(실측 6시간), pred 테이블 조회/적재 로직. → 백엔드(:8010)·프론트 무변경.

그래프 정책(중요): 차트는 [관측 history] 뒤에 [+12step 미래 예측]을 이어 붙인다.
이미 관측된 구간은 예측을 덮어 그리지 않는다(관측선/예측선을 base_time 에서 연결).
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
import torch

KST = timezone(timedelta(hours=9))

SCR_DIR = Path(__file__).resolve().parents[1]   # ...\harness\scr
if str(SCR_DIR) not in sys.path:
    sys.path.insert(0, str(SCR_DIR))

import config  # noqa: E402
from model_st3 import IntakeST3EncoderModel  # noqa: E402

try:  # psycopg2 미설치 환경에서도 대시보드는 compute fallback 으로 동작
    import db  # noqa: E402
except Exception:  # pragma: no cover
    db = None

# 경로는 config.HARNESS_DIR(frozen-aware) 기준.
HARNESS_DIR = config.HARNESS_DIR
PROJECT_ROOT = HARNESS_DIR.parent
MODEL_ROOT = HARNESS_DIR / "output" / "codex_khnp_model_test"
STATS_DIR = HARNESS_DIR / "_workspace" / "p4_stats"

HISTORY_LEN = 48
HORIZON = 12
INTERVAL_MIN = 30
OBS_HISTORY = 13   # 차트에 보여줄 관측 history 길이(13점 = base_time 포함 6시간; 미래도 6시간으로 대칭)
_DEPLOY_DIR = "st3_deploy"   # 모델 폴더: output/codex_khnp_model_test/st3_deploy/{unit}.pt

# ST3 입력 채널 순서(모델 학습과 동일) — 바꾸지 말 것(stats·모델·DB조립 1:1).
JMA_COLS = ["air_temp", "wind_u", "wind_v"]                        # x_jma 채널
HYCOM_COLS = ["water_temp_0m", "water_temp_2m", "water_temp_4m"]   # x_hycom 채널

# unitId → (site 한글명, 모델 파일 stem). type 코드 == unitId.
UNIT_MODELS: dict[str, tuple[str, str]] = {
    "sws1": ("신월성1호기", "sws1"),
    "sws2": ("신월성2호기", "sws2"),
    "ws2": ("월성2호기", "ws2"),
    "ws3": ("월성3호기", "ws3"),
    "ws4": ("월성4호기", "ws4"),
}

# unitId → 예측 적재/조회 테이블
PRED_TABLE: dict[str, str] = {
    "sws1": config.TABLE_PRED_SWS, "sws2": config.TABLE_PRED_SWS,
    "ws2": config.TABLE_PRED_WS, "ws3": config.TABLE_PRED_WS, "ws4": config.TABLE_PRED_WS,
}


def _sws(unit: str) -> bool:
    return unit in ("sws1", "sws2")


def _intake_table(unit: str) -> str:
    return config.TABLE_SWS if _sws(unit) else config.TABLE_WS


def _jma_table(unit: str) -> str:
    return config.TABLE_JMA_SWS if _sws(unit) else config.TABLE_JMA_WS


def _hycom_table(unit: str) -> str:
    return config.TABLE_HYCOM_SWS if _sws(unit) else config.TABLE_HYCOM_WS


INTAKE_STALE_MIN = 90   # 취수구 최신 관측이 이 분(分) 이내여야 live 예측
INTAKE_MAX_GAP_MIN = 90  # history 창 안 취수구 관측 공백이 이 분 초과면 no_data(보간으로 메우지 않음)
PRED_STALE_MIN = 180    # 대시보드: pred 테이블 base_time 이 이 분 이내여야 'ok'


def _model_pt(stem: str) -> Path:
    return MODEL_ROOT / _DEPLOY_DIR / f"{stem}.pt"


def _stats(unit_id: str) -> dict:
    """ST3 정규화 통계 npz. 키: intake_mean/std, jma_mean/std[3], hycom_mean/std[3].
    ⚠️ 서버엔 학습 CSV 없음 → npz 필수(재생성 불가). 없으면 FileNotFoundError(조용히 틀리는 것보다 낫다)."""
    cache = STATS_DIR / f"{unit_id}_norm_stats.npz"
    if not cache.exists():
        raise FileNotFoundError(f"norm_stats 없음(필수): {cache}")
    z = np.load(cache, allow_pickle=True)
    return {k: np.asarray(z[k], dtype=np.float32) for k in z.files}


@lru_cache(maxsize=8)
def _load(unit_id: str):
    """ST3 모델 + 정규화 통계 로드. self-describing .pt 의 config 로 클래스 조립."""
    if unit_id not in UNIT_MODELS:
        raise KeyError(f"unknown unit: {unit_id}")
    _site, stem = UNIT_MODELS[unit_id]
    pt = _model_pt(stem)
    if not pt.exists():
        raise FileNotFoundError(f"model not found: {pt}")
    ckpt = torch.load(pt, map_location="cpu", weights_only=False)
    cfg = ckpt["config"]
    model = IntakeST3EncoderModel(
        jma_offsets=[tuple(o) for o in cfg["jma_offsets"]],
        hycom_offsets=[tuple(o) for o in cfg["hycom_offsets"]],
        d_model=cfg["d_model"], gru_layers=cfg["gru_layers"],
        num_heads_spatial=cfg["num_heads_spatial"], dropout=cfg["dropout"],
        hist_len=cfg["hist_len"], horizon=cfg["horizon"])
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    stats = _stats(unit_id)
    return model, stats, ckpt


def available_units() -> list[str]:
    """모델 .pt 가 실제로 존재하는 호기 목록."""
    return [u for u, (_, stem) in UNIT_MODELS.items() if _model_pt(stem).exists()]


def _forward_real(model, stats, intake_arr, jma_arr, hycom_arr) -> np.ndarray:
    """정규화 → ST3 forward → real °C. target_mode=residual_last(모델 출력=정규화 절대 intake).
    intake_arr (1,48,1), jma_arr (1,60,3), hycom_arr (1,60,3). 반환 (12,) °C."""
    im = stats["intake_mean"].reshape(-1)[0]
    istd = stats["intake_std"].reshape(-1)[0]
    x_int = ((intake_arr - im) / istd).astype(np.float32)                          # (1,48,1)
    x_jma = ((jma_arr - stats["jma_mean"]) / stats["jma_std"]).astype(np.float32)  # (1,60,3)
    x_hyc = ((hycom_arr - stats["hycom_mean"]) / stats["hycom_std"]).astype(np.float32)
    x_jma = x_jma[:, :, None, :]   # (1,60,1,3)  G=1 중심 토큰
    x_hyc = x_hyc[:, :, None, :]
    with torch.no_grad():
        pred_norm = model(x_intake=torch.tensor(x_int),
                          x_jma=torch.tensor(x_jma),
                          x_hycom=torch.tensor(x_hyc)).cpu().numpy()   # (1,12,1) 정규화 절대
    return pred_norm.reshape(-1) * istd + im   # 역정규화(절대), prev+ 없음


def _max_dt(table: str, unit_id: str):
    if db is None:
        return None
    try:
        v = db.fetch_all(f"SELECT max(datetime) FROM {table} WHERE type=%s", (unit_id,))[0][0]
    except Exception:
        return None
    return v.replace(tzinfo=None) if v else None


def latest_observation(unit_id: str) -> dict:
    """취수구 최신 실관측 1건(예측 파이프라인과 무관). 종합현황표 '현재값' 표시용.
    예측이 no_data(history 공백) 여도 현재 수온은 DB 최신 관측으로 그대로 보여준다."""
    if unit_id not in UNIT_MODELS or db is None:
        return {"currentValue": None, "observedAt": None}
    try:
        rows = db.fetch_all(
            f"SELECT datetime, temp FROM {_intake_table(unit_id)} "
            f"WHERE type=%s AND temp IS NOT NULL ORDER BY datetime DESC LIMIT 1",
            (unit_id,),
        )
    except Exception:
        return {"currentValue": None, "observedAt": None}
    if not rows:
        return {"currentValue": None, "observedAt": None}
    dt_, temp = rows[0]
    ts = pd.Timestamp(dt_).to_pydatetime().replace(tzinfo=None)
    return {"currentValue": round(float(temp), 3), "observedAt": ts.isoformat()}


def _intake_max_gap_min(unit_id: str, start, end) -> float | None:
    """history 창 안 취수구 '실관측' 사이 최대 공백(분). 자료 전무면 창 전체를 공백으로 본다."""
    if db is None:
        return None
    rows = db.fetch_all(
        f"SELECT datetime FROM {_intake_table(unit_id)} WHERE type=%s AND datetime BETWEEN %s AND %s ORDER BY datetime",
        (unit_id, (start - pd.Timedelta(days=2)).to_pydatetime(), end.to_pydatetime()),
    )
    ts = [pd.Timestamp(r[0]) for r in rows]
    before = [t for t in ts if t <= start]
    inwin = [t for t in ts if start < t <= end]
    seq = [before[-1] if before else start] + inwin + [end]
    if len(seq) < 2:
        return None
    return max((b - a).total_seconds() / 60.0 for a, b in zip(seq[:-1], seq[1:]))


def _db_series_30min(table: str, unit_id: str, cols: list[str], start, end, buffer_min: int = 180):
    """DB → 30분 격자 시계열(type 별). 결측은 time 보간. 자료 없으면 None.
    격자 시작점 보간 anchor 확보를 위해 start 보다 buffer_min 앞부터 조회(외삽 아님, 실관측 사용)."""
    if db is None:
        return None
    colsql = ", ".join(cols)
    q_start = start - pd.Timedelta(minutes=buffer_min)
    rows = db.fetch_all(
        f"SELECT datetime, {colsql} FROM {table} WHERE type=%s AND datetime BETWEEN %s AND %s ORDER BY datetime",
        (unit_id, q_start.to_pydatetime(), end.to_pydatetime()),
    )
    if not rows:
        return None
    df = pd.DataFrame(rows, columns=["datetime", *cols])
    df["datetime"] = pd.to_datetime(df["datetime"])
    df = df.dropna(subset=["datetime"]).set_index("datetime").sort_index()
    df = df[~df.index.duplicated(keep="last")].astype(float)
    grid = pd.date_range(start, end, freq=f"{INTERVAL_MIN}min")
    return df.reindex(df.index.union(grid)).interpolate(method="time").reindex(grid)


def live_compute(unit_id: str) -> dict:
    """local DB(취수구 실시간 + JMA/HYCOM 30분 예보)로 12-step 미래 예측(ST3, 3입력).
    입력 윈도우를 못 만들면 status='no_data' + 사유(임의/과거 값으로 대체 금지)."""
    if unit_id not in UNIT_MODELS:
        return {"status": "unknown_unit", "unitId": unit_id, "predictions": []}
    if db is None:
        return {"status": "no_data", "unitId": unit_id, "reason": "DB 미연결",
                "missing": ["DB"], "predictions": []}

    model, stats, _ = _load(unit_id)
    now = datetime.now(KST).replace(tzinfo=None)
    base_time = pd.Timestamp(now).floor(f"{INTERVAL_MIN}min")
    hist_start = base_time - pd.Timedelta(minutes=INTERVAL_MIN * (HISTORY_LEN - 1))
    exog_end = base_time + pd.Timedelta(minutes=INTERVAL_MIN * HORIZON)

    missing: list[str] = []
    it_max = _max_dt(_intake_table(unit_id), unit_id)
    if it_max is None or it_max < now - timedelta(minutes=INTAKE_STALE_MIN):
        missing.append("취수구 실시간")
    # history 창 안 장시간 관측 공백이면 예측 금지(보간으로 메우지 않음)
    gap = _intake_max_gap_min(unit_id, hist_start, base_time)
    if gap is None or gap > INTAKE_MAX_GAP_MIN:
        missing.append(f"취수구 관측 공백({int(gap)}분)" if gap else "취수구 관측 공백")

    intake = _db_series_30min(_intake_table(unit_id), unit_id, ["temp"], hist_start, base_time)
    hycom = _db_series_30min(_hycom_table(unit_id), unit_id, HYCOM_COLS, hist_start, exog_end)
    jma = _db_series_30min(_jma_table(unit_id), unit_id, JMA_COLS, hist_start, exog_end)

    if intake is None or intake["temp"].isna().any():
        missing.append("취수구 실시간")
    if hycom is None or hycom.isna().any().any():
        missing.append("HYCOM 예보")
    if jma is None or jma.isna().any().any():
        missing.append("JMA 예보")
    if missing:
        miss = list(dict.fromkeys(missing))
        return {"status": "no_data", "unitId": unit_id,
                "reason": "실시간 예측 입력자료 미수신/불완전: " + ", ".join(miss),
                "missing": miss, "currentValue": None, "predictions": []}

    intake_arr = intake["temp"].to_numpy(np.float32)[None, :, None]                     # (1,48,1)
    jma_arr = np.stack([jma[c].to_numpy(np.float32) for c in JMA_COLS], axis=-1)[None]  # (1,60,3)
    hycom_arr = np.stack([hycom[c].to_numpy(np.float32) for c in HYCOM_COLS], axis=-1)[None]
    prev = float(intake["temp"].iloc[-1])
    pred = _forward_real(model, stats, intake_arr, jma_arr, hycom_arr)

    preds = []
    for i in range(HORIZON):
        tt = base_time + pd.Timedelta(minutes=INTERVAL_MIN * (i + 1))
        preds.append({"targetTime": tt.isoformat(), "temp": round(float(pred[i]), 3)})
    return {"status": "ok", "unitId": unit_id, "source": "live",
            "baseTime": base_time.isoformat(), "currentValue": round(prev, 3),
            "predictions": preds}


def compute_prediction(unit_id: str) -> dict:
    """live_compute 별칭(서버 live 경로). DB 미연결이면 no_data."""
    return live_compute(unit_id)


def upsert_prediction(unit_id: str, result: dict | None = None) -> int:
    """live_compute 결과를 pred 테이블에 upsert(같은 대상시각이면 갱신). 반환 row 수."""
    if db is None:
        raise RuntimeError("psycopg2(db) 미설치 — DB 적재 불가")
    res = result or live_compute(unit_id)
    if res.get("status") != "ok" or not res.get("predictions"):
        return 0
    table = PRED_TABLE[unit_id]
    base_time = res["baseTime"]
    rows = [(base_time, p["targetTime"], unit_id, p["temp"]) for p in res["predictions"]]
    return db.upsert_rows(table, ("base_time", "datetime", "type", "temp"), rows)


def _read_pred_from_db(unit_id: str) -> tuple[pd.Timestamp | None, list[dict]]:
    """DB 최신 base_time 의 예측을 읽는다. (base_time, [{targetTime, temp}])."""
    if db is None:
        return None, []
    table = PRED_TABLE[unit_id]
    try:
        rows = db.fetch_all(
            f"SELECT datetime, temp, base_time FROM {table} "
            f"WHERE type = %s AND base_time = "
            f"(SELECT max(base_time) FROM {table} WHERE type = %s) "
            f"ORDER BY datetime",
            (unit_id, unit_id),
        )
    except Exception:
        return None, []
    if not rows:
        return None, []
    base_time = pd.Timestamp(rows[0][2])
    preds = [{"targetTime": pd.Timestamp(r[0]).isoformat(),
              "temp": (round(float(r[1]), 3) if r[1] is not None else None)} for r in rows]
    return base_time, preds


def _prior_predictions(unit_id: str, start: pd.Timestamp, end: pd.Timestamp) -> dict:
    """실측(과거) 구간 각 30분 시각에 대해 '그 시각 직전 최신 예측값'.
    = pred 테이블에서 datetime=해당시각, base_time < datetime 중 base_time 최대(가장 최근에 그 시각을 예측한 값).
    회색 '이전 예측' 선(예보 vs 실측 비교)용. 데이터 없으면 빈 dict."""
    if db is None:
        return {}
    table = PRED_TABLE[unit_id]
    try:
        rows = db.fetch_all(
            f"SELECT DISTINCT ON (datetime) datetime, temp FROM {table} "
            f"WHERE type = %s AND datetime BETWEEN %s AND %s AND base_time < datetime "
            f"ORDER BY datetime, base_time DESC",
            (unit_id, start.to_pydatetime(), end.to_pydatetime()),
        )
    except Exception:
        return {}
    out = {}
    for dt, temp in rows:
        out[pd.Timestamp(dt)] = round(float(temp), 3) if temp is not None else None
    return out


def _intake_observed_30min(unit_id: str, base_time: pd.Timestamp, k: int) -> list[dict]:
    """취수구 관측 30분 격자 마지막 k개(<=base_time). 차트 '관측' 선."""
    start = base_time - pd.Timedelta(minutes=INTERVAL_MIN * (k - 1))
    s = _db_series_30min(_intake_table(unit_id), unit_id, ["temp"], start, base_time)
    if s is None:
        return []
    out = []
    for ts, r in s.iterrows():
        v = r["temp"]
        out.append({"datetime": pd.Timestamp(ts), "temp": (round(float(v), 3) if pd.notna(v) else None)})
    return out


def latest_prediction(unit_id: str) -> dict:
    """대시보드용: pred 테이블 최신 예측(신선) + 취수구 관측 history → 차트.
    예측이 없거나 오래됐거나 취수구 관측이 끊기면 'no_data'(임의 값 금지)."""
    if unit_id not in UNIT_MODELS:
        return {"status": "unknown_unit", "unitId": unit_id, "predictions": []}
    if db is None:
        return {"status": "no_data", "unitId": unit_id, "reason": "DB 미연결", "predictions": []}

    base_time, future = _read_pred_from_db(unit_id)
    now = datetime.now(KST).replace(tzinfo=None)
    if base_time is None or not future:
        return {"status": "no_data", "unitId": unit_id,
                "reason": "예측 없음 (predict 미실행)", "predictions": []}
    if base_time.to_pydatetime().replace(tzinfo=None) < now - timedelta(minutes=PRED_STALE_MIN):
        return {"status": "no_data", "unitId": unit_id,
                "reason": f"예측이 오래됨 (기준 {base_time:%m-%d %H:%M})", "predictions": []}

    history = _intake_observed_30min(unit_id, base_time, OBS_HISTORY)
    if not history or all(h["temp"] is None for h in history):
        return {"status": "no_data", "unitId": unit_id, "reason": "취수구 관측 없음", "predictions": []}
    current_value = history[-1]["temp"]

    # 실측 구간에 겹쳐 보여줄 '이전 예측'(그 시각 직전 최신 forecast) — 회색 비교선
    prior = _prior_predictions(unit_id, history[0]["datetime"], base_time)

    points: list[dict] = []
    for h in history[:-1]:
        points.append({"targetTime": h["datetime"].isoformat(),
                       "observedValue": h["temp"], "predictedValue": None,
                       "priorPredictedValue": prior.get(pd.Timestamp(h["datetime"]))})
    points.append({"targetTime": base_time.isoformat(),
                   "observedValue": current_value, "predictedValue": current_value,
                   "priorPredictedValue": prior.get(pd.Timestamp(base_time))})
    for p in future:
        points.append({"targetTime": p["targetTime"],
                       "observedValue": None, "predictedValue": p["temp"],
                       "priorPredictedValue": None})

    # currentValue = DB 최신 수집 관측(상태카드 '현재 수온', 라이브).
    # baseObserved = 예측 입력의 마지막 관측(base_time 30분 격자값) — '마지막 관측수온'/추세 기준.
    obs_latest = latest_observation(unit_id).get("currentValue")
    report_current = obs_latest if obs_latest is not None else current_value
    return {"status": "ok", "unitId": unit_id, "source": "db",
            "baseTime": base_time.isoformat(),
            "currentValue": report_current,
            "baseObserved": current_value,
            "predictions": points}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--unit", default="sws1")
    args = ap.parse_args()
    print("available:", available_units())
    print(json.dumps(latest_prediction(args.unit), ensure_ascii=False, indent=2))
