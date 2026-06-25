"""실시간 취수구 수온예측 대시보드 백엔드 (FastAPI).

- 신월성1호기(sws1): 저장된 delta_horizon_decoder 로 실제 12-step 추론(inference.latest_prediction).
- 나머지 호기: mock 예측(predictionAvailable=true, source="mock").
- 발전소 단지(고리/새울/월성/한빛/한울) → 호기 2단계 계층.
- 운영 보간 금지: 추론 실패/데이터 부족은 status 필드로 표시(가짜 값 반환 금지).

실행: uvicorn app:app --reload --port 8000  (env: khnp_model_test)
"""
from __future__ import annotations

import json
import math
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import inference
import users_store

try:  # DB(psycopg2) 없으면 소스 상태는 unknown 으로 degrade
    import config as _cfg
    import db as _db
except Exception:  # pragma: no cover
    _cfg = None
    _db = None

KST = timezone(timedelta(hours=9))
HORIZON = 12
INTERVAL_MIN = 30

# 예보 단계: 설계해수온도(제한치) 대비 예측 수온으로 산정.
# 제한치 -4℃ → 관심, -3℃ → 주의, -2℃ → 경보, 제한치 이상 → 심각. 제한치 null → '없음'.
# 제한치 원본: scr/json_folder/design_seatemp_limits.json (호기 한글명 → 설계해수온도).
_UNIT_LIMIT_NAME = {"sws1": "신월성1", "sws2": "신월성2", "ws2": "월성2", "ws3": "월성3", "ws4": "월성4"}


def _load_unit_limits() -> dict:
    out: dict[str, Optional[float]] = {u: None for u in _UNIT_LIMIT_NAME}
    try:
        base = _cfg.SCR_DIR if _cfg else Path(__file__).resolve().parents[1]
        data = json.loads((base / "json_folder" / "design_seatemp_limits.json").read_text(encoding="utf-8"))
        limits = data.get("limits", {})
        for u, name in _UNIT_LIMIT_NAME.items():
            out[u] = limits.get(name)
    except Exception:
        pass
    return out


UNIT_LIMITS = _load_unit_limits()


def _forecast_level(value: float | None, unit_id: str) -> str:
    limit = UNIT_LIMITS.get(unit_id)
    if limit is None:
        return "없음"          # 제한치 미설정(예: 월성2/3/4)
    if value is None:
        return "여유"
    if value >= limit:
        return "심각"
    if value >= limit - 2:
        return "경보"
    if value >= limit - 3:
        return "주의"
    if value >= limit - 4:
        return "관심"
    return "여유"

# 운영 전환: CORS 허용 도메인은 환경변수로 제한(쉼표 구분). 기본=로컬 프론트.
ALLOWED_ORIGINS = os.getenv(
    "DASHBOARD_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
# JWT: 운영 시 DASHBOARD_JWT_SECRET 를 반드시 강한 값으로 설정.
JWT_SECRET = os.getenv("DASHBOARD_JWT_SECRET", "dev-only-secret-change-me")
JWT_ALG = "HS256"
JWT_EXP_HOURS = int(os.getenv("DASHBOARD_JWT_EXP_HOURS", "168"))  # dev 기본 7일(만료 잦음 방지)

app = FastAPI(title="KHNP 취수구 수온예측 대시보드 API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_token(user: dict) -> str:
    payload = {
        "sub": user["id"], "name": user["name"], "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def require_auth(authorization: str = Header(default="")) -> dict:
    """Authorization: Bearer <jwt> 검증. 실패 시 401."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증 토큰이 없습니다.")
    token = authorization.split(" ", 1)[1]
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")

# ---------------------------------------------------------------------------
# 발전소 단지 · 호기 레지스트리 (사용자 제공 좌표). 새울은 고리와 동일좌표라 약간 offset.
# ---------------------------------------------------------------------------
SITES = [
    {"siteId": "kori", "siteName": "고리 원자력발전소", "region": "부산광역시 기장군",
     "latitude": 35.319904, "longitude": 129.290053},
    {"siteId": "saeul", "siteName": "새울 원자력발전소", "region": "울산광역시 울주군",
     "latitude": 35.335650, "longitude": 129.311458},  # 35°20'08.34"N 129°18'41.25"E
    {"siteId": "wolsong", "siteName": "월성 원자력발전소", "region": "경상북도 경주시",
     "latitude": 35.71667, "longitude": 129.47778},
    {"siteId": "hanbit", "siteName": "한빛 원자력발전소", "region": "전라남도 영광군",
     "latitude": 35.415, "longitude": 126.42389},
    {"siteId": "hanul", "siteName": "한울 원자력발전소", "region": "경상북도 울진군",
     "latitude": 37.09278, "longitude": 129.38361},
]

# 호기: 월성 단지에만 예측 대상 호기 존재. sws1=실모델, 나머지=mock(학습중).
# 5호기 모두 실모델(fixed_valtest_h48) 연결. baseTemp 는 mock fallback 용.
UNITS = [
    {"unitId": "sws1", "unitName": "신월성1호기", "siteId": "wolsong", "source": "model", "baseTemp": 17.5},
    {"unitId": "sws2", "unitName": "신월성2호기", "siteId": "wolsong", "source": "model", "baseTemp": 17.8},
    {"unitId": "ws2", "unitName": "월성2호기", "siteId": "wolsong", "source": "model", "baseTemp": 18.2},
    {"unitId": "ws3", "unitName": "월성3호기", "siteId": "wolsong", "source": "model", "baseTemp": 17.9},
    {"unitId": "ws4", "unitName": "월성4호기", "siteId": "wolsong", "source": "model", "baseTemp": 18.0},
]
UNIT_BY_ID = {u["unitId"]: u for u in UNITS}


def _now_kst() -> datetime:
    return datetime.now(KST)


def _unit_status(unit: dict) -> str:
    # 데모: 실모델은 normal, mock 은 baseTemp 로 단순 분류
    if unit["source"] == "model":
        return "normal"
    return "normal" if unit["baseTemp"] < 18.0 else "warning"


def _site_payload(site: dict) -> dict:
    units = [u for u in UNITS if u["siteId"] == site["siteId"]]
    return {
        **{k: site[k] for k in ("siteId", "siteName", "region", "latitude", "longitude")},
        "unitCount": len(units),
        "predictionAvailable": any(u["source"] == "model" for u in units),
        "status": "normal" if units else "offline",
        "lastUpdatedAt": _now_kst().isoformat(),
    }


def _unit_payload(unit: dict) -> dict:
    return {
        "unitId": unit["unitId"], "unitName": unit["unitName"], "siteId": unit["siteId"],
        "status": _unit_status(unit),
        "predictionAvailable": True,
        "source": unit["source"],
        "lastUpdatedAt": _now_kst().isoformat(),
    }


def _mock_predictions(unit: dict) -> dict:
    base = _now_kst().replace(second=0, microsecond=0)
    rng = random.Random(hash(unit["unitId"]) & 0xFFFF)
    cur = unit["baseTemp"] + rng.uniform(-0.5, 0.5)
    points = []
    for i in range(HORIZON):
        tt = base + timedelta(minutes=INTERVAL_MIN * (i + 1))
        val = cur + 0.6 * math.sin(i / 3.0) + rng.uniform(-0.2, 0.2)
        points.append({"targetTime": tt.isoformat(), "predictedValue": round(val, 3),
                       "observedValue": None})
    return {"status": "ok", "unitId": unit["unitId"], "baseTime": base.isoformat(),
            "currentValue": round(cur, 3), "source": "mock", "predictions": points}


# ---------------------------------------------------------------------------
# 인증 (mock/JWT 유사). 실서버 연동 시 이 부분만 교체.
# ---------------------------------------------------------------------------
class LoginReq(BaseModel):
    username: str
    password: str


class SignupReq(BaseModel):
    username: str
    password: str
    name: Optional[str] = None
    phone: Optional[str] = None


def require_admin(_user: dict = Depends(require_auth)) -> dict:
    if _user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    return _user


@app.post("/api/auth/login")
def login(req: LoginReq):
    if not req.username or not req.password:
        raise HTTPException(status_code=401, detail="아이디/비밀번호를 입력하세요.")
    user = users_store.verify(req.username.strip(), req.password)
    if not user:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    if not user.get("approved"):
        raise HTTPException(status_code=403, detail="관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.")
    return {"accessToken": create_token(user), "user": user}


@app.post("/api/auth/signup")
def signup(req: SignupReq):
    ok, msg = users_store.add_user(req.username, req.password, req.name, req.phone)
    if not ok:
        raise HTTPException(status_code=409, detail=msg)
    # 승인 대기 상태이므로 토큰 발급하지 않음(바로 로그인 불가)
    return {"pending": True, "message": msg}


@app.get("/api/admin/users")
def admin_list_users(_admin: dict = Depends(require_admin)):
    return {"users": users_store.list_users()}


@app.post("/api/admin/users/{user_id}/approve")
def admin_approve(user_id: str, _admin: dict = Depends(require_admin)):
    if not users_store.set_approved(user_id, True):
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return {"ok": True, "userId": user_id, "approved": True}


@app.post("/api/admin/users/{user_id}/revoke")
def admin_revoke(user_id: str, _admin: dict = Depends(require_admin)):
    if not users_store.set_approved(user_id, False):
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return {"ok": True, "userId": user_id, "approved": False}


@app.delete("/api/admin/users/{user_id}")
def admin_delete(user_id: str, _admin: dict = Depends(require_admin)):
    if not users_store.delete_user(user_id):
        raise HTTPException(status_code=400, detail="삭제할 수 없는 사용자입니다(관리자 본인/없음).")
    return {"ok": True, "userId": user_id, "deleted": True}


@app.get("/api/sites")
def list_sites(_user: dict = Depends(require_auth)):
    return {"sites": [_site_payload(s) for s in SITES]}


@app.get("/api/sites/{site_id}")
def get_site(site_id: str, _user: dict = Depends(require_auth)):
    site = next((s for s in SITES if s["siteId"] == site_id), None)
    if not site:
        raise HTTPException(status_code=404, detail="발전소를 찾을 수 없습니다.")
    units = [_unit_payload(u) for u in UNITS if u["siteId"] == site_id]
    return {**_site_payload(site), "units": units}


@app.get("/api/units/{unit_id}")
def get_unit(unit_id: str, _user: dict = Depends(require_auth)):
    unit = UNIT_BY_ID.get(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="호기를 찾을 수 없습니다.")
    return _unit_payload(unit)


@app.get("/api/units/{unit_id}/predictions")
def get_predictions(unit_id: str, _user: dict = Depends(require_auth)):
    unit = UNIT_BY_ID.get(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="호기를 찾을 수 없습니다.")
    if unit["source"] == "model":
        try:
            return inference.latest_prediction(unit_id)
        except Exception as e:  # 추론 실패는 가짜값 대신 상태로
            return {"status": "model_error", "unitId": unit_id, "detail": str(e)[:200],
                    "predictions": []}
    return _mock_predictions(unit)


@app.get("/api/units/{unit_id}/realtime")
def get_realtime(unit_id: str, _user: dict = Depends(require_auth)):
    unit = UNIT_BY_ID.get(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="호기를 찾을 수 없습니다.")
    pred = get_predictions(unit_id, _user)
    cur = pred.get("currentValue")
    if cur is None:  # 예측 no_data 여도 DB 최신 관측으로 현재값 표시
        cur = inference.latest_observation(unit_id).get("currentValue")
    return {"unitId": unit_id, "status": pred.get("status", "ok"),
            "currentValue": cur,
            "baseTime": pred.get("baseTime"), "apiStatus": "connected",
            "lastUpdatedAt": _now_kst().isoformat()}


@app.get("/api/units/{unit_id}/alerts")
def get_alerts(unit_id: str, _user: dict = Depends(require_auth)):
    unit = UNIT_BY_ID.get(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="호기를 찾을 수 없습니다.")
    alerts = []
    if _unit_status(unit) == "warning":
        alerts.append({"alertId": f"{unit_id}-w1", "unitId": unit_id, "level": "warning",
                       "message": "예측 수온이 주의 기준에 근접했습니다.",
                       "createdAt": _now_kst().isoformat()})
    return {"unitId": unit_id, "alerts": alerts}


# 현황표 현재값 신선도: 최근 N분 이내 관측이어야 'live'(ok). 기본 120분(수집 끊기면 자동 no_data).
OBS_FRESH_MIN = int(os.getenv("DASHBOARD_OBS_FRESH_MIN", "120"))


@app.get("/api/summary")
def summary(_user: dict = Depends(require_auth)):
    """종합 현황표용: 현재값은 DB 최신 관측(예측과 무관), +30/+60 은 예측이 신선할 때만."""
    out = []
    now = _now_kst().replace(tzinfo=None)
    for u in UNITS:
        if u["source"] != "model":
            continue
        # 현재값 = DB 취수구 최신 실관측. 예측이 no_data 여도 현재 수온은 보인다.
        obs = inference.latest_observation(u["unitId"])
        cur = obs.get("currentValue")
        observed_at = obs.get("observedAt")
        fresh = False
        if observed_at:
            try:
                fresh = (now - datetime.fromisoformat(observed_at)) <= timedelta(minutes=OBS_FRESH_MIN)
            except Exception:
                fresh = False
        # +30/+60 예측은 pred 테이블이 신선(ok)할 때만 채운다.
        try:
            pred = inference.latest_prediction(u["unitId"])
        except Exception:
            pred = {"status": "model_error", "predictions": []}
        pts = pred.get("predictions", []) if pred.get("status") == "ok" else []
        future = [p for p in pts if p.get("observedValue") is None and p.get("predictedValue") is not None]
        p30 = future[0]["predictedValue"] if len(future) >= 1 else None
        p60 = future[1]["predictedValue"] if len(future) >= 2 else None
        # 예보 단계 기준: 6시간(12스텝) 예측 중 한 번이라도 임계에 걸리면 그 단계로 표시 → horizon 최댓값.
        peak = max((p["predictedValue"] for p in future), default=None)
        # 추세(상승률): 그래프 상세와 동일 — (마지막 예측 - 예측입력 마지막관측)/스텝수 = ℃/30분 평균(6시간 기준).
        # 기준은 라이브 현재값(cur)이 아니라 예측에 쓰인 base_time 관측(baseObserved).
        base_obs = pred.get("baseObserved")
        rate = None
        if base_obs is not None and future:
            rate = (future[-1]["predictedValue"] - base_obs) / len(future)
        trend = "flat"
        if rate is not None:
            trend = "up" if rate > 0 else ("down" if rate < 0 else "flat")
        # 최신 관측이 있으면 'ok'(현재값 표시). 수집이 끊겨 오래되면 no_data.
        status = "ok" if (cur is not None and fresh) else "no_data"
        out.append({
            "unitId": u["unitId"], "unitName": u["unitName"], "siteId": u["siteId"],
            "status": status,
            "currentValue": cur if status == "ok" else None,
            "baseObserved": base_obs,   # 예측 입력의 마지막 관측(base_time 30분 격자) — '마지막 관측수온' 표시값
            "observedAt": observed_at,
            "p30": p30, "p60": p60,
            "trend": trend,
            "rate": round(rate, 4) if rate is not None else None,
            "level": _forecast_level(peak, u["unitId"]),
            "limit": UNIT_LIMITS.get(u["unitId"]),
        })
    return {"units": out}


# 소스 신선도: 최신 적재 시각이 (현재 - STALE_HOURS) 이상이어야 '정상 연결'.
# 과거 일괄적재분만 있고 최신 수집이 끊긴 경우 connected=false 가 되도록.
SOURCE_STALE_HOURS = int(os.getenv("DASHBOARD_SOURCE_STALE_HOURS", "48"))


def _latest_dt(tables: list[str]):
    if _db is None:
        return None
    vals = []
    for t in tables:
        try:
            v = _db.fetch_all(f"SELECT max(datetime) FROM {t}")[0][0]
        except Exception:
            v = None
        if v is not None:
            vals.append(v.replace(tzinfo=None))
    return max(vals) if vals else None


def _source_state(tables: list[str], mode: str) -> dict:
    """mode='future': 미래(now 이후) 자료가 있으면 연결(예보 피드: JMA/HYCOM).
    mode='recency': 최신 적재가 STALE_HOURS 이내면 연결(실시간 관측: 한수원)."""
    latest = _latest_dt(tables)
    if latest is None:
        return {"connected": False, "latest": None}
    now_naive = datetime.now(KST).replace(tzinfo=None)
    if mode == "future":
        connected = latest > now_naive
    else:
        connected = latest >= now_naive - timedelta(hours=SOURCE_STALE_HOURS)
    return {"connected": bool(connected), "latest": latest.isoformat()}


@app.get("/api/sources")
def sources(_user: dict = Depends(require_auth)):
    """소스 연결 상태. JMA/HYCOM=미래(예보)자료 존재 여부, 한수원=실시간 수신 신선도."""
    if _cfg is None or _db is None:
        return {"sources": {k: {"connected": False, "latest": None}
                            for k in ("khnp", "jma", "hycom")}}
    return {"sources": {
        "khnp": _source_state([_cfg.TABLE_SWS, _cfg.TABLE_WS], "recency"),
        "jma": _source_state([_cfg.TABLE_JMA_SWS, _cfg.TABLE_JMA_WS], "future"),
        "hycom": _source_state([_cfg.TABLE_HYCOM_SWS, _cfg.TABLE_HYCOM_WS], "future"),
    }}


@app.get("/api/health")
def health():
    return {"status": "ok", "time": _now_kst().isoformat()}


# --- 프론트(React 빌드물) 정적 서빙 ---------------------------------------
# 단일 도메인(ngrok/Cloudflare 등) 1개로 UI + API 를 함께 제공하기 위함.
# /api/* 와 /docs 등은 위에서 먼저 매칭되고, 그 외 경로만 여기로 온다:
#   - dist 안에 실제 파일이 있으면 그 파일(예: /assets/xxx.js)
#   - 없으면 SPA 라우팅이므로 index.html 반환
_DIST = Path(__file__).resolve().parents[1] / "dashboard" / "dist"


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    candidate = _DIST / full_path
    if full_path and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(_DIST / "index.html")
