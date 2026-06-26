"""호기별 12-step 수온 추론 어댑터 (5호기 일반화) + 예측 DB 적재/조회.

그래프 정책(중요): 차트는 [관측 history] 뒤에 [+12step 미래 예측]을 이어 붙인다.
이미 관측된 구간은 예측을 덮어 그리지 않는다(관측선/예측선을 base_time 에서 연결).

데이터 경로
- 추론: 학습과 동일하게 준비 df(for_AI_train) + 저장 model 로 12-step 예측.
- 적재: compute_prediction() 결과를 pred_sws_temp/pred_ws_temp 에 upsert(30분마다, runner).
- 조회: latest_prediction() 은 DB(최신 base_time) 예측을 우선 읽고, 비어 있으면 즉석 compute.

모델: {unit}_20260623_fixed_valtest_h48_... (known6, history48, horizon12, target_mode=delta).
정규화는 scaler 미저장 → train(2014~2023) 윈도우 통계 재구성(호기별 npz 캐시).
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

import p2_khnp_experiment as p2  # noqa: E402
import config  # noqa: E402

try:  # psycopg2 미설치 환경에서도 대시보드는 compute fallback 으로 동작
    import db  # noqa: E402
except Exception:  # pragma: no cover
    db = None

# 경로는 config.HARNESS_DIR(frozen-aware) 기준 — exe 로 빌드돼도 실제 harness 를 가리킨다.
HARNESS_DIR = config.HARNESS_DIR
PROJECT_ROOT = HARNESS_DIR.parent
DATA_ROOT = PROJECT_ROOT / "data" / "for_AI_train"
MODEL_ROOT = HARNESS_DIR / "output" / "codex_khnp_model_test"
STATS_DIR = HARNESS_DIR / "_workspace" / "p4_stats"

TARGET_MODE = "delta"
TRAIN_YEAR_START, TRAIN_YEAR_END = 2014, 2023   # fixed_valtest_range 의 train 구간(=2014~2023)
INTERVAL_MIN = 30
OBS_HISTORY = 13   # 차트에 보여줄 관측 history 길이(13점 = base_time 포함 6시간; 미래도 6시간으로 대칭)
_FOLDER_SUFFIX = "20260623_fixed_valtest_h48_20240701_20240831_20250701_20250825"

# unitId → (site 한글명, 모델 폴더 prefix). type 코드 == unitId.
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


# 모델 feature_col → (DB 테이블종류, DB 컬럼). live 입력 조립용.
FEATURE_DB = {
    "idw_water_temp_0m": ("hycom", "water_temp_0m"),
    "idw_water_temp_2m": ("hycom", "water_temp_2m"),
    "idw_water_temp_4m": ("hycom", "water_temp_4m"),
    "idw_air_temp": ("jma", "air_temp"),
    "idw_wind_u": ("jma", "wind_u"),
    "idw_wind_v": ("jma", "wind_v"),
}
INTAKE_STALE_MIN = 90   # 취수구 최신 관측이 이 분(分) 이내여야 live 예측
INTAKE_MAX_GAP_MIN = 90  # history 창 안 취수구 관측 공백이 이 분 초과면 no_data(보간으로 메우지 않음)
PRED_STALE_MIN = 180    # 대시보드: pred 테이블 base_time 이 이 분 이내여야 'ok'


def _model_pt(prefix: str) -> Path:
    return MODEL_ROOT / f"{prefix}_{_FOLDER_SUFFIX}" / "models" / "delta_horizon_decoder.pt"


def _load_full_df(site: str) -> pd.DataFrame:
    return p2.load_site_dataframe(DATA_ROOT, site, p2.KNOWN_FUTURE_COLS, max_rows=None)


def _train_stats(unit_id: str) -> dict:
    """정규화 통계: npz 캐시가 있으면 그대로(=서버에 큰 CSV 불필요).
    캐시가 없을 때만 train CSV 를 읽어 재구성 후 캐시."""
    cache = STATS_DIR / f"{unit_id}_norm_stats.npz"
    if cache.exists():
        z = np.load(cache, allow_pickle=True)
        return {k: z[k] for k in z.files}
    site = UNIT_MODELS[unit_id][0]
    df = _load_full_df(site)
    train = df[(df["datetime"].dt.year >= TRAIN_YEAR_START) &
               (df["datetime"].dt.year <= TRAIN_YEAR_END)].copy()
    raw = {"train": p2.build_windows(train, p2.HISTORY_LEN, p2.HORIZON, 4, p2.KNOWN_FUTURE_COLS)}
    _, stats = p2.normalize_bundles(raw, TARGET_MODE)
    cache.parent.mkdir(parents=True, exist_ok=True)
    np.savez(cache, **{k: np.asarray(v) for k, v in stats.items()})
    return stats


@lru_cache(maxsize=8)
def _load(unit_id: str):
    """모델 + 정규화 통계 + feature_cols 로드. live_compute 는 CSV 불필요(stats 캐시 사용)."""
    if unit_id not in UNIT_MODELS:
        raise KeyError(f"unknown unit: {unit_id}")
    _site, prefix = UNIT_MODELS[unit_id]
    pt = _model_pt(prefix)
    if not pt.exists():
        raise FileNotFoundError(f"model not found: {pt}")
    ckpt = torch.load(pt, map_location="cpu", weights_only=False)
    cfg = ckpt.get("config", {})
    feature_cols = ckpt.get("feature_cols", p2.KNOWN_FUTURE_COLS)
    hidden = int(cfg.get("hidden_dim", 128))
    heads = int(cfg.get("attn_heads", 4))
    model = p2.DeltaHorizonDecoderModel(1, len(feature_cols), hidden, p2.HORIZON, heads)
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    stats = _train_stats(unit_id)
    return model, stats, feature_cols


def available_units() -> list[str]:
    """모델 .pt 가 실제로 존재하는 호기 목록."""
    return [u for u, (_, p) in UNIT_MODELS.items() if _model_pt(p).exists()]


def compute_prediction(unit_id: str) -> dict:
    """마지막 완성 윈도우로 12-step '미래' 예측을 계산(관측은 포함 안 함).

    end 를 HORIZON 만큼 뒤로 둬서 known-future 외생변수(exog)가 실제 존재하도록 한다.
    반환: {status, baseTime, currentValue, predictions:[{targetTime, temp}, ...]}
    """
    model, stats, feature_cols = _load(unit_id)
    df = _load_full_df(UNIT_MODELS[unit_id][0])  # CSV 백테스트 경로(서버 live 예측엔 미사용)
    if len(df) < p2.HISTORY_LEN + p2.HORIZON:
        return {"status": "insufficient_history", "unitId": unit_id, "predictions": []}

    end = len(df) - p2.HORIZON - 1
    hist = df.iloc[end - p2.HISTORY_LEN + 1: end + 1]
    exog = df.iloc[end - p2.HISTORY_LEN + 1: end + 1 + p2.HORIZON]

    intake = hist[["target"]].to_numpy(np.float32)[None]
    exog_arr = exog[feature_cols].to_numpy(np.float32)[None]
    prev = np.float32(hist.iloc[-1]["target"])

    x_int = (intake - stats["intake_mean"]) / stats["intake_std"]
    x_exo = (exog_arr - stats["exog_mean"]) / stats["exog_std"]
    with torch.no_grad():
        pred_norm = model(torch.tensor(x_int), torch.tensor(x_exo)).cpu().numpy()
    delta = pred_norm * stats["target_std"] + stats["target_mean"]
    pred = (prev + delta).reshape(-1)

    base_time = pd.Timestamp(hist.iloc[-1]["datetime"])
    preds = []
    for i in range(p2.HORIZON):
        tt = base_time + pd.Timedelta(minutes=INTERVAL_MIN * (i + 1))
        preds.append({"targetTime": tt.isoformat(), "temp": round(float(pred[i]), 3)})
    return {
        "status": "ok", "unitId": unit_id, "source": "model",
        "baseTime": base_time.isoformat(), "currentValue": round(float(prev), 3),
        "predictions": preds,
    }


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
    """history 창 안 취수구 '실관측' 사이 최대 공백(분). 자료 전무면 창 전체를 공백으로 본다.
    선형보간으로 메우기 전에, 실제 관측이 끊긴 구간이 큰지 판정하는 용도."""
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
    """local DB(취수구 실시간 + JMA/HYCOM 30분 예보)로 12-step 미래 예측.
    입력 윈도우를 못 만들면 status='no_data' + 사유(임의/과거 값으로 대체 금지)."""
    if unit_id not in UNIT_MODELS:
        return {"status": "unknown_unit", "unitId": unit_id, "predictions": []}
    if db is None:
        return {"status": "no_data", "unitId": unit_id, "reason": "DB 미연결",
                "missing": ["DB"], "predictions": []}

    model, stats, feature_cols = _load(unit_id)
    now = datetime.now(KST).replace(tzinfo=None)
    base_time = pd.Timestamp(now).floor(f"{INTERVAL_MIN}min")
    hist_start = base_time - pd.Timedelta(minutes=INTERVAL_MIN * (p2.HISTORY_LEN - 1))
    exog_end = base_time + pd.Timedelta(minutes=INTERVAL_MIN * p2.HORIZON)

    missing: list[str] = []
    it_max = _max_dt(_intake_table(unit_id), unit_id)
    if it_max is None or it_max < now - timedelta(minutes=INTAKE_STALE_MIN):
        missing.append("취수구 실시간")
    # history 창 안 장시간 관측 공백이면 예측 금지(보간으로 메우지 않음)
    gap = _intake_max_gap_min(unit_id, hist_start, base_time)
    if gap is None or gap > INTAKE_MAX_GAP_MIN:
        missing.append(f"취수구 관측 공백({int(gap)}분)" if gap else "취수구 관측 공백")

    intake = _db_series_30min(_intake_table(unit_id), unit_id, ["temp"], hist_start, base_time)
    hycom = _db_series_30min(_hycom_table(unit_id), unit_id,
                             ["water_temp_0m", "water_temp_2m", "water_temp_4m"], hist_start, exog_end)
    jma = _db_series_30min(_jma_table(unit_id), unit_id,
                           ["air_temp", "wind_u", "wind_v"], hist_start, exog_end)

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

    exog_cols = []
    for fc in feature_cols:
        kind, col = FEATURE_DB[fc]
        src = hycom if kind == "hycom" else jma
        exog_cols.append(src[col].to_numpy(np.float32))
    exog_arr = np.stack(exog_cols, axis=-1)[None]            # (1, HIST+HORIZON, 6)
    intake_arr = intake["temp"].to_numpy(np.float32)[None, :, None]  # (1, HIST, 1)
    prev = np.float32(intake["temp"].iloc[-1])

    x_int = (intake_arr - stats["intake_mean"]) / stats["intake_std"]
    x_exo = (exog_arr - stats["exog_mean"]) / stats["exog_std"]
    with torch.no_grad():
        pred_norm = model(torch.tensor(x_int), torch.tensor(x_exo)).cpu().numpy()
    delta = pred_norm * stats["target_std"] + stats["target_mean"]
    pred = (prev + delta).reshape(-1)

    preds = []
    for i in range(p2.HORIZON):
        tt = base_time + pd.Timedelta(minutes=INTERVAL_MIN * (i + 1))
        preds.append({"targetTime": tt.isoformat(), "temp": round(float(pred[i]), 3)})
    return {"status": "ok", "unitId": unit_id, "source": "live",
            "baseTime": base_time.isoformat(), "currentValue": round(float(prev), 3),
            "predictions": preds}


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
