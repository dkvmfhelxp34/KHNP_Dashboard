// MSW 핸들러: 실 API contract 와 동일한 경로/응답 (백엔드 없이 데모)
import { http, HttpResponse } from "msw";
import { mockSites, mockUnits, findUnit, mockPredictions, mockAlerts, mockSummary, mockSources } from "./mockData";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export const handlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (!body?.email || !body?.password) {
      return HttpResponse.json({ detail: "이메일/비밀번호를 입력하세요." }, { status: 401 });
    }
    const role = body.email.toLowerCase().includes("admin") ? "admin" : "user";
    return HttpResponse.json({
      accessToken: `mock-token-${role}`,
      user: { id: "user-001", name: body.email.split("@")[0], role },
    });
  }),

  http.get(`${API}/summary`, () => HttpResponse.json({ units: mockSummary() })),

  http.get(`${API}/sources`, () => HttpResponse.json({ sources: mockSources() })),

  http.get(`${API}/sites`, () => HttpResponse.json({ sites: mockSites })),

  http.get(`${API}/sites/:siteId`, ({ params }) => {
    const site = mockSites.find((s) => s.siteId === params.siteId);
    if (!site) return HttpResponse.json({ detail: "not found" }, { status: 404 });
    return HttpResponse.json({ ...site, units: mockUnits[site.siteId as string] ?? [] });
  }),

  http.get(`${API}/units/:unitId`, ({ params }) => {
    const unit = findUnit(params.unitId as string);
    if (!unit) return HttpResponse.json({ detail: "not found" }, { status: 404 });
    return HttpResponse.json(unit);
  }),

  http.get(`${API}/units/:unitId/predictions`, ({ params }) =>
    HttpResponse.json(mockPredictions(params.unitId as string)),
  ),

  http.get(`${API}/units/:unitId/realtime`, ({ params }) => {
    const p = mockPredictions(params.unitId as string);
    return HttpResponse.json({ unitId: params.unitId, status: "ok", currentValue: p.currentValue, baseTime: p.baseTime, apiStatus: "mock", lastUpdatedAt: new Date().toISOString() });
  }),

  http.get(`${API}/units/:unitId/alerts`, ({ params }) =>
    HttpResponse.json({ unitId: params.unitId, alerts: mockAlerts(params.unitId as string) }),
  ),
];
