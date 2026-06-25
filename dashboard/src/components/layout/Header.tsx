// 상단 고정 헤더(Tesla): 프로스트 화이트 배경, 자간 넓힌 워드마크, 그림자 없음
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

export default function Header() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-[1000] flex h-14 items-center justify-between bg-electric px-6 text-white shadow-sm">
      <div
        className="flex cursor-pointer items-center gap-2.5"
        onClick={() => navigate("/dashboard")}
      >
        {/* 한수원 로고: public/hansuwon_logo.png. 파란 바 위라 흰색으로 반전 표시 */}
        <img
          src="/hansuwon_logo.png"
          alt="한국수력원자력"
          className="h-7 w-auto brightness-0 invert"
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
        />
        <span className="text-[17px] font-semibold tracking-[0.02em] text-white">
          인공지능(AI) 기반 취수구 해수온도 예측 시스템
        </span>
      </div>
      <div className="flex items-center gap-1 text-sm">
        {user?.role === "admin" && (
          <button
            className="rounded-tesla px-3 py-1.5 text-white/85 hover:bg-white/15 hover:text-white"
            onClick={() => navigate("/admin")}
          >
            사용자 관리
          </button>
        )}
        <button
          className="rounded-tesla px-3 py-1.5 text-white/85 hover:bg-white/15 hover:text-white"
          onClick={() => { logout(); navigate("/login"); }}
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
