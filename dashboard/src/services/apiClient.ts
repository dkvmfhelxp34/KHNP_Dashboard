// 중앙 axios 클라이언트. 백엔드 주소는 환경변수 한 곳에서 관리.
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// 요청마다 저장된 토큰을 Authorization 헤더로 주입 (authStore 의 persist 키 사용)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("khnp.accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 이면 토큰 제거 + 로그인 화면으로 이동 (만료 토큰 자동 재로그인 유도)
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("khnp.accessToken");
      localStorage.removeItem("khnp.auth");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
