"""대시보드 로그인 사용자 저장소 (간단·로컬용).

- 사용자 목록을 JSON 파일에 저장: harness/_workspace/dashboard_users.json
- 비밀번호는 평문 저장하지 않고 pbkdf2-sha256 해시(+per-user salt)로 저장.
- 최초 실행 시 관리자 계정(admin) 시드. 비번 변경은 reset_admin() 또는 파일 삭제 후 재시드.

NOTE: 본격 운영이라면 DB + 표준 라이브러리(passlib 등)로 교체 권장. 여기선 로컬 데모 수준.
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
from pathlib import Path

try:
    import config
    _BASE = config.HARNESS_DIR / "_workspace"
except Exception:  # config 못 불러와도 동작하도록 폴백
    _BASE = Path(__file__).resolve().parents[1] / "_workspace"

USERS_FILE = _BASE / "dashboard_users.json"
_PBKDF2_ROUNDS = 200_000

# 시드 관리자 계정 (최초 1회 생성). 비번은 환경변수로도 덮어쓸 수 있음.
_ADMIN_ID = os.getenv("DASHBOARD_ADMIN_ID", "admin")
_ADMIN_PW = os.getenv("DASHBOARD_ADMIN_PW", "change-me")
_ADMIN_NAME = "관리자"


def _hash(password: str, salt: str) -> str:
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _PBKDF2_ROUNDS)
    return dk.hex()


def _make_record(user_id: str, password: str, name: str, role: str, approved: bool,
                 phone: str = "") -> dict:
    salt = secrets.token_hex(16)
    return {"id": user_id, "name": name, "phone": phone, "role": role, "approved": approved,
            "salt": salt, "hash": _hash(password, salt)}


def _load() -> dict:
    if USERS_FILE.exists():
        try:
            return json.loads(USERS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"users": {}}


def _save(data: dict) -> None:
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    USERS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _ensure_admin(data: dict) -> dict:
    """관리자 계정이 없으면 시드(승인됨). 이미 있으면 그대로(비번 보존)."""
    if _ADMIN_ID not in data["users"]:
        data["users"][_ADMIN_ID] = _make_record(_ADMIN_ID, _ADMIN_PW, _ADMIN_NAME, "admin", True)
        _save(data)
    return data


def reset_admin(new_password: str | None = None) -> None:
    """관리자 비밀번호 재설정(운영 중 변경용)."""
    data = _load()
    pw = new_password or _ADMIN_PW
    data["users"][_ADMIN_ID] = _make_record(_ADMIN_ID, pw, _ADMIN_NAME, "admin", True)
    _save(data)


def verify(user_id: str, password: str) -> dict | None:
    """ID/PW 검증. 성공 시 {id,name,role,approved}, 실패 시 None."""
    data = _ensure_admin(_load())
    rec = data["users"].get(user_id)
    if not rec:
        return None
    if _hash(password, rec["salt"]) != rec["hash"]:
        return None
    return {"id": rec["id"], "name": rec["name"], "role": rec["role"],
            "approved": bool(rec.get("approved", False))}


def add_user(user_id: str, password: str, name: str | None = None,
             phone: str | None = None) -> tuple[bool, str]:
    """회원가입. (성공여부, 메시지). 일반 사용자(role=user)로 생성하되 '승인 대기'(approved=False)."""
    user_id = (user_id or "").strip()
    name = (name or "").strip()
    phone = (phone or "").strip()
    if not name:
        return False, "이름을 입력하세요."
    if not phone:
        return False, "전화번호를 입력하세요."
    if len(user_id) < 3:
        return False, "아이디는 3자 이상이어야 합니다."
    if len(password or "") < 4:
        return False, "비밀번호는 4자 이상이어야 합니다."
    data = _ensure_admin(_load())
    if user_id in data["users"]:
        return False, "이미 존재하는 아이디입니다."
    data["users"][user_id] = _make_record(user_id, password, name, "user", False, phone)
    _save(data)
    return True, "다 받았습니다. 관리자 승인을 기다리세요."


# --- 관리자용: 사용자 목록/승인/삭제 ---
def list_users() -> list[dict]:
    data = _ensure_admin(_load())
    return [{"id": r["id"], "name": r["name"], "phone": r.get("phone", ""), "role": r["role"],
             "approved": bool(r.get("approved", False))}
            for r in data["users"].values()]


def set_approved(user_id: str, approved: bool) -> bool:
    data = _ensure_admin(_load())
    rec = data["users"].get(user_id)
    if not rec:
        return False
    rec["approved"] = approved
    _save(data)
    return True


def delete_user(user_id: str) -> bool:
    data = _ensure_admin(_load())
    if user_id == _ADMIN_ID or user_id not in data["users"]:
        return False  # 관리자 본인은 삭제 불가
    del data["users"][user_id]
    _save(data)
    return True
