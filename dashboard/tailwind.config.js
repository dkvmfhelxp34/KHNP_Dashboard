/** @type {import('tailwindcss').Config} */
// Tesla 디자인 시스템(DESIGN-tesla.md) 토큰. 단색+Electric Blue 1개 강조.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 운영 상태색만 의미색으로 유지(관제 대시보드 필수). 나머지는 무채색.
        status: {
          normal: "#16a34a",
          warning: "#eab308",
          danger: "#dc2626",
          offline: "#8E8E8E",
        },
        // Tesla 팔레트
        electric: "#3E6AE1", // 유일한 강조색(Primary CTA)
        carbon: "#171A20", // 제목/주요 텍스트
        graphite: "#393C41", // 본문
        pewter: "#5C5E62", // 보조 링크/캡션
        silver: "#8E8E8E", // placeholder/disabled
        cloud: "#EEEEEE", // 경계선/디바이더
        pale: "#D0D1D2", // 보조 경계선
        ash: "#F4F4F4", // 대체 표면
        // brand 를 electric 으로 통일(기존 클래스 호환)
        brand: { DEFAULT: "#3E6AE1", light: "#5b82ea" },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Pretendard",
          "sans-serif",
        ],
      },
      borderRadius: {
        // Tesla: 4px 기본, 카드 12px
        tesla: "4px",
        card: "12px",
      },
      transitionTimingFunction: {
        tesla: "cubic-bezier(0.5, 0, 0, 0.75)",
      },
    },
  },
  plugins: [],
};
