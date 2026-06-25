// 카드형 지표 표시 (Tesla: 플랫, 그림자 없음, 경계선만)
interface Props {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  accent?: boolean;
}

export default function StatusCard({ label, value, unit, hint, accent }: Props) {
  return (
    <div
      className={`rounded-card border bg-white p-4 ${
        accent ? "border-electric" : "border-cloud"
      }`}
    >
      <div className="text-xs text-pewter">{label}</div>
      <div className="mt-1.5 text-2xl font-medium text-carbon">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-silver">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-silver">{hint}</div>}
    </div>
  );
}
