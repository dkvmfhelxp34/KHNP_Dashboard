// MSW 브라우저 워커 (VITE_USE_MOCK=true 일 때만 시작)
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
