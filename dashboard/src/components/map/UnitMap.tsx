// Leaflet 지도 + 발전소 단지 마커.
// 마커: 참조 이미지대로 '냉각탑 실루엣 + 방사능 트레포일' SVG divIcon. 본체 색 = 상태색.
// 지도 라이브러리 교체 시 이 컴포넌트만 바꾸면 됨.
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import type { Site, UnitStatus } from "../../types";
import { STATUS_COLOR, STATUS_LABEL } from "../../utils/status";

// --- 방사능 트레포일 path 생성 (중심 0,0 기준) ---
const rad = (d: number) => (d * Math.PI) / 180;
const pt = (r: number, a: number): [string, string] => [
  (r * Math.cos(rad(a))).toFixed(2),
  (r * Math.sin(rad(a))).toFixed(2),
];
function blade(center: number, ri: number, ro: number): string {
  const a0 = center - 30;
  const a1 = center + 30;
  const [x0i, y0i] = pt(ri, a0);
  const [x0o, y0o] = pt(ro, a0);
  const [x1o, y1o] = pt(ro, a1);
  const [x1i, y1i] = pt(ri, a1);
  return `M${x0i} ${y0i} L${x0o} ${y0o} A${ro} ${ro} 0 0 1 ${x1o} ${y1o} L${x1i} ${y1i} A${ri} ${ri} 0 0 0 ${x0i} ${y0i} Z`;
}
const BLADES = [90, 210, 330].map((c) => blade(c, 2.4, 6.2)).join(" ");

function plantIcon(status: UnitStatus): L.DivIcon {
  const color = STATUS_COLOR[status];
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
  <ellipse cx="20" cy="45" rx="9" ry="1.8" fill="rgba(23,26,32,0.18)"/>
  <g fill="${color}">
    <path d="M12 4.5 H28 L26.4 9 H13.6 Z"/>
    <path d="M13.6 9 H26.4 C24.6 20 27 31 30 40 H10 C13 31 15.4 20 13.6 9 Z"/>
    <rect x="9" y="41.4" width="22" height="2.6"/>
  </g>
  <g transform="translate(20 27)">
    <circle r="7.4" fill="#ffffff"/>
    <g fill="${color}">
      <path d="${BLADES}"/>
      <circle r="1.7"/>
    </g>
  </g>
</svg>`;
  return L.divIcon({
    html: svg,
    className: "plant-marker",
    iconSize: [40, 48],
    iconAnchor: [20, 43],
    tooltipAnchor: [0, -40],
  });
}

interface Props {
  sites: Site[];
  onSelect: (site: Site) => void;
}

// 남한 대략 경계(마커가 동/남해안에 몰려 있어 전체 남한이 보이도록 bounds 로 맞춤)
const KOREA_BOUNDS: [[number, number], [number, number]] = [
  [34.0, 125.8],
  [38.7, 129.8],
];

export default function UnitMap({ sites, onSelect }: Props) {
  // 남한 중심
  const center: [number, number] = [36.5, 127.8];
  return (
    <MapContainer
      center={center}
      zoom={7}
      minZoom={6}
      bounds={KOREA_BOUNDS}
      className="h-full w-full"
      scrollWheelZoom
    >
      {/* Esri World Imagery: 위성영상 타일(무료·무키). z/y/x 순서 주의. */}
      <TileLayer
        attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      {sites.map((s) => (
        <Marker
          key={s.siteId}
          position={[s.latitude, s.longitude]}
          icon={plantIcon(s.status)}
          eventHandlers={{ click: () => onSelect(s) }}
        >
          <Tooltip direction="top">
            <div className="text-xs">
              <b>{s.siteName}</b>
              <br />
              {s.region} · {STATUS_LABEL[s.status]}
              <br />
              호기 {s.unitCount} · 예측 {s.predictionAvailable ? "가능" : "준비중"}
            </div>
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
