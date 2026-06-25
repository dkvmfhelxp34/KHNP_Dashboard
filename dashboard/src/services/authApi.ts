import { apiClient } from "./apiClient";
import type { LoginResponse } from "../types";

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/auth/login", { username, password });
  return data;
}

// 회원가입은 '승인 대기' 상태로 생성되어 바로 로그인되지 않음(토큰 없음).
export async function signup(payload: {
  username: string;
  password: string;
  name: string;
  phone: string;
}): Promise<{ pending: boolean; message: string }> {
  const { data } = await apiClient.post<{ pending: boolean; message: string }>(
    "/auth/signup",
    payload,
  );
  return data;
}
