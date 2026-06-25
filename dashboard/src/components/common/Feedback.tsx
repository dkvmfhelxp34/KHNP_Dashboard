// 로딩/에러/빈데이터 공통 표시 컴포넌트 (Tesla 톤)
export function Loading({ label = "불러오는 중..." }: { label?: string }) {
  return <div className="flex items-center justify-center p-6 text-pewter">{label}</div>;
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="m-4 rounded-tesla border border-cloud bg-ash p-3 text-sm text-status-danger">
      오류: {message}
    </div>
  );
}

export function EmptyState({ label = "데이터가 없습니다." }: { label?: string }) {
  return <div className="p-6 text-center text-silver">{label}</div>;
}
