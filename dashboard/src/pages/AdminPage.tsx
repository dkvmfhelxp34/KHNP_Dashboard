// 관리자 페이지: 회원가입 신청 승인/거절/삭제 (admin 전용).
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "../components/layout/Header";
import { Loading, ErrorMessage } from "../components/common/Feedback";
import { fetchUsers, approveUser, revokeUser, deleteUser } from "../services/adminApi";

export default function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const usersQ = useQuery({ queryKey: ["adminUsers"], queryFn: fetchUsers, refetchInterval: 15000 });

  const refresh = () => qc.invalidateQueries({ queryKey: ["adminUsers"] });
  const mApprove = useMutation({ mutationFn: approveUser, onSuccess: refresh });
  const mRevoke = useMutation({ mutationFn: revokeUser, onSuccess: refresh });
  const mDelete = useMutation({ mutationFn: deleteUser, onSuccess: refresh });

  const users = usersQ.data ?? [];
  const pending = users.filter((u) => !u.approved);

  return (
    <div className="flex h-full flex-col bg-white">
      <Header />
      <div className="flex-1 overflow-y-auto p-8">
        <button onClick={() => navigate("/dashboard")} className="mb-4 text-sm text-electric hover:underline">
          ← 종합 현황으로 돌아가기
        </button>
        <h1 className="mb-1 text-xl font-medium text-carbon">사용자 관리</h1>
        <p className="mb-6 text-sm text-pewter">
          회원가입 신청은 <span className="font-medium text-carbon">승인 대기</span> 상태로 들어옵니다.
          승인해야 해당 사용자가 로그인할 수 있습니다.
          {pending.length > 0 && <span className="ml-2 text-status-warning">대기 {pending.length}건</span>}
        </p>

        {usersQ.isLoading && <Loading />}
        {usersQ.isError && <ErrorMessage message="사용자 목록을 불러오지 못했습니다(관리자만 가능)." />}

        {usersQ.data && (
          <div className="overflow-hidden rounded-card border border-cloud">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ash text-left text-xs text-pewter">
                  <th className="px-4 py-2 font-medium">아이디</th>
                  <th className="px-4 py-2 font-medium">이름</th>
                  <th className="px-4 py-2 font-medium">전화번호</th>
                  <th className="px-4 py-2 font-medium">권한</th>
                  <th className="px-4 py-2 font-medium">상태</th>
                  <th className="px-4 py-2 font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-cloud text-graphite">
                    <td className="px-4 py-2 text-carbon">{u.id}</td>
                    <td className="px-4 py-2">{u.name}</td>
                    <td className="px-4 py-2">{u.phone || "-"}</td>
                    <td className="px-4 py-2">{u.role === "admin" ? "관리자" : "사용자"}</td>
                    <td className="px-4 py-2">
                      {u.approved ? (
                        <span className="text-green-600">승인됨</span>
                      ) : (
                        <span className="text-status-warning">승인 대기</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {u.role === "admin" ? (
                        <span className="text-silver">—</span>
                      ) : (
                        <div className="flex gap-2">
                          {u.approved ? (
                            <button
                              onClick={() => mRevoke.mutate(u.id)}
                              className="rounded-tesla border border-cloud px-2 py-1 text-xs text-pewter hover:text-carbon"
                            >
                              승인 취소
                            </button>
                          ) : (
                            <button
                              onClick={() => mApprove.mutate(u.id)}
                              className="rounded-tesla bg-electric px-2 py-1 text-xs text-white hover:brightness-95"
                            >
                              승인
                            </button>
                          )}
                          <button
                            onClick={() => { if (confirm(`${u.id} 계정을 삭제할까요?`)) mDelete.mutate(u.id); }}
                            className="rounded-tesla border border-cloud px-2 py-1 text-xs text-status-danger hover:bg-ash"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
