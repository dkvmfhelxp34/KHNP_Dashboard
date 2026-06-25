// 상단 고정 헤더(Tesla): 프로스트 화이트 배경, 자간 넓힌 워드마크, 그림자 없음
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

export default function Header() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-[1000] flex h-14 items-center justify-between border-b border-cloud bg-white/75 px-6 backdrop-blur">
      <div
        className="flex cursor-pointer items-center gap-2.5"
        onClick={() => navigate("/dashboard")}
      >
        {/* 한수원 로고: public/hansuwon_logo.png 에 파일을 두면 표시됨(없으면 숨김) */}
        <img
          src="/hansuwon_logo.png"
          alt="한국수력원자력"
          className="h-7 w-auto"
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
        />
        <span className="text-[18px] font-medium tracking-[0.12em] text-carbon">
          취수구 해수온도 예측 시스템
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-graphite">
        {user?.role === "admin" && (
          <button
            className="rounded-tesla px-3 py-1.5 text-pewter hover:bg-ash hover:text-carbon"
            onClick={() => navigate("/admin")}
          >
            사용자 관리
          </button>
        )}
        <button
          className="rounded-tesla px-3 py-1.5 text-pewter hover:bg-ash hover:text-carbon"
          onClick={() => { logout(); navigate("/login"); }}
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
