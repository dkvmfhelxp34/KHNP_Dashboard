/** @type {import('tailwindcss').Config} */
// Tesla 디자인 시스템(DESIGN-tesla.md) 토큰. 단색+Electric Blue 1개 강조.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 참고 이미지 디자인 팔레트
        status: {
          normal: "#11A37F", // Secondary Green
          warning: "#F59E0B", // Warning Orange
          danger: "#E53935", // Alert Red
          offline: "#8E8E8E",
        },
        electric: "#0B5CAB", // Primary Blue (헤더/강조/CTA)
        sky: "#EAF4FF", // Sky Blue (연한 강조 배경/선택)
        mist: "#F7F8FA", // Light Gray (페이지 배경)
        carbon: "#171A20", // 제목/주요 텍스트
        graphite: "#393C41", // 본문
        pewter: "#5C5E62", // 보조 링크/캡션
        silver: "#8E8E8E", // placeholder/disabled
        cloud: "#EEEEEE", // 경계선/디바이더
        pale: "#D0D1D2", // 보조 경계선
        ash: "#F4F4F4", // 대체 표면
        brand: { DEFAULT: "#0B5CAB", light: "#2f7fd1" },
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "Pretendard Variable",
          "-apple-system",
          "Segoe UI",
          "Roboto",
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
