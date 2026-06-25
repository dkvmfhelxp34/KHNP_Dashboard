# KHNP Dashboard (홈페이지)

한수원(KHNP) 관측·예측 데이터를 보여주는 웹 대시보드.
**프론트엔드(`dashboard/`)** 와 **백엔드 API(`dashboard_api/`)** 두 부분으로 구성된다.

## 구성

```text
dashboard/        # 프론트엔드 (React + Vite + TypeScript + TailwindCSS)
  src/            #   페이지/컴포넌트/스토어/서비스
  public/         #   정적 자원(로고, 아이콘 등)
  .env.example    #   환경변수 예시 (.env 로 복사해서 사용)
dashboard_api/    # 백엔드 (FastAPI)
  app.py          #   API 엔드포인트 + JWT 인증
  users_store.py  #   로그인 사용자 저장소(pbkdf2 해시)
  inference.py    #   모델 추론 로직
```

## 실행

### 프론트엔드
```bash
cd dashboard
cp .env.example .env        # 필요 시 값 수정
npm install
npm run dev                 # 개발 서버
npm run build               # 배포 빌드 (dist/)
```

### 백엔드
```bash
# 의존성: fastapi, uvicorn, pyjwt, pydantic, numpy, pandas, torch
pip install fastapi uvicorn pyjwt pydantic numpy pandas torch
uvicorn app:app --host 0.0.0.0 --port 8000
```

## 환경변수 (비밀값은 코드에 두지 말 것)

| 변수 | 용도 | 기본값 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 프론트엔드가 호출할 API 주소 | `/api` |
| `VITE_USE_MOCK` | MSW 목업 사용 여부 | `false` |
| `DASHBOARD_JWT_SECRET` | JWT 서명 키 | `dev-only-secret-change-me` |
| `DASHBOARD_ADMIN_ID` | 시드 관리자 ID | `admin` |
| `DASHBOARD_ADMIN_PW` | 시드 관리자 비밀번호 | `change-me` (반드시 운영 시 env로 지정) |

## 알려진 한계 (known limitations)

- 백엔드(`app.py`, `inference.py`)는 상위 harness 디렉터리의 `config` 모듈과
  `p2_khnp_experiment` 모듈을 import한다. 따라서 **이 저장소만으로는 백엔드가 단독 실행되지 않으며**,
  전체 harness 환경 안에서 동작한다. 이 저장소는 홈페이지 코드의 백업/버전관리 용도다.
- 로그인 사용자 데이터(`dashboard_users.json`), JWT 시크릿, 관리자 비밀번호 등 운영 비밀값은
  저장소에 포함하지 않는다(환경변수/별도 파일로 주입).
