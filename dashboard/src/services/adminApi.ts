import { apiClient } from "./apiClient";
import type { AdminUser } from "../types";

export async function fetchUsers(): Promise<AdminUser[]> {
  const { data } = await apiClient.get<{ users: AdminUser[] }>("/admin/users");
  return data.users;
}

export async function approveUser(userId: string): Promise<void> {
  await apiClient.post(`/admin/users/${userId}/approve`);
}

export async function revokeUser(userId: string): Promise<void> {
  await apiClient.post(`/admin/users/${userId}/revoke`);
}

export async function deleteUser(userId: string): Promise<void> {
  await apiClient.delete(`/admin/users/${userId}`);
}
