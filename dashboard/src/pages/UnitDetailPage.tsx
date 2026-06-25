// 호기 상세 페이지(직접 URL 접근용). 본문은 UnitDetailView 공용 컴포넌트 재사용.
// 대시보드 내에서는 팝업(UnitDetailModal)으로 같은 내용을 띄운다.
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/layout/Header";
import UnitDetailView from "../components/dashboard/UnitDetailView";

export default function UnitDetailPage() {
  const { unitId = "" } = useParams();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col bg-white">
      <Header />
      <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto p-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-4 text-sm text-electric hover:underline"
        >
          ← 대시보드로 돌아가기
        </button>
        <UnitDetailView unitId={unitId} />
      </div>
    </div>
  );
}
