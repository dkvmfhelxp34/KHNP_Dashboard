// 인증 상태 (Zustand + persist). 토큰은 apiClient 가 읽도록 localStorage 에도 별도 저장.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem("khnp.accessToken", token);
        set({ token, user });
      },
      logout: () => {
        localStorage.removeItem("khnp.accessToken");
        set({ token: null, user: null });
      },
    }),
    { name: "khnp.auth" },
  ),
);
