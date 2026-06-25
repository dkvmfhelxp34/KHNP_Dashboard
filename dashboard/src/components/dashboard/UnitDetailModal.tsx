// 시계열 상세 팝업. 현황판/종합현황에서 호기를 누르면 떠서 UnitDetailView 를 보여준다.
// 배경 클릭 또는 ESC/닫기 버튼으로 닫힘.
import { useEffect } from "react";
import UnitDetailView from "./UnitDetailView";

export default function UnitDetailModal({
  unitId,
  onClose,
}: {
  unitId: string;
  onClose: () => void;
}) {
  // ESC 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-carbon/40 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-pop relative my-2 w-full max-w-4xl rounded-card border border-cloud bg-white p-5 shadow-xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-tesla text-pewter hover:bg-ash hover:text-carbon"
        >
          ✕
        </button>
        <UnitDetailView unitId={unitId} />
      </div>
    </div>
  );
}
