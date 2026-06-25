import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login, signup } from "../services/authApi";
import { useAuthStore } from "../stores/authStore";

const INPUT =
  "mb-4 mt-1 w-full rounded-tesla border border-pale bg-white px-3 py-2.5 text-sm text-carbon outline-none placeholder:text-silver focus:border-electric";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await login(username, password);
        setAuth(res.accessToken, res.user);
        navigate("/dashboard");
      } else {
        // 회원가입: 승인 대기 → 바로 로그인 안 됨. 안내 후 로그인 화면으로.
        const res = await signup({ username, password, name, phone });
        setInfo(res.message);
        setMode("login");
        setPassword("");
      }
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? (mode === "login" ? "로그인에 실패했습니다." : "회원가입에 실패했습니다."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-white px-4">
      <form onSubmit={onSubmit} className="w-[360px]">
        <div className="mb-9 text-center">
          <img
            src="/hansuwon_logo.png"
            alt="한국수력원자력"
            className="mx-auto h-10 w-auto"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
          <h1 className="mt-5 whitespace-nowrap text-[22px] font-medium tracking-tight text-carbon">
            취수구 해수온도 예측 시스템
          </h1>
          {mode === "signup" && <p className="mt-2 text-sm text-pewter">새 계정을 만듭니다.</p>}
        </div>

        {mode === "signup" && (
          <>
            <label className="block text-[13px] text-pewter">이름</label>
            <input
              className={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />

            <label className="block text-[13px] text-pewter">전화번호</label>
            <input
              className={INPUT}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              placeholder="010-0000-0000"
              autoComplete="tel"
              required
            />
          </>
        )}

        <label className="block text-[13px] text-pewter">아이디</label>
        <input
          className={INPUT}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />

        <label className="block text-[13px] text-pewter">비밀번호</label>
        <input
          className={INPUT}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />

        {error && <div className="mb-4 text-sm text-status-danger">{error}</div>}
        {info && <div className="mb-4 rounded-tesla bg-ash p-2.5 text-center text-sm text-graphite">{info}</div>}

        <button
          type="submit"
          disabled={loading}
          className="h-10 w-full rounded-tesla bg-electric text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
        >
          {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setInfo(""); }}
          className="mt-4 w-full text-center text-xs text-pewter hover:text-carbon"
        >
          {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
        </button>
      </form>
    </div>
  );
}
