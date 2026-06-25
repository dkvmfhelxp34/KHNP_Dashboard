// 인증/권한 가드. 미인증 → /login, 권한 부족 → /dashboard.
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "../../stores/authStore";

interface Props {
  children: ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin }: Props) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (requireAdmin && user?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
