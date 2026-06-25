import { apiClient } from "./apiClient";
import type { Site, SiteDetail, Unit, Alert, UnitSummary, SourcesResponse } from "../types";

export async function fetchSummary(): Promise<UnitSummary[]> {
  const { data } = await apiClient.get<{ units: UnitSummary[] }>("/summary");
  return data.units;
}

export async function fetchSources(): Promise<SourcesResponse> {
  const { data } = await apiClient.get<{ sources: SourcesResponse }>("/sources");
  return data.sources;
}

export async function fetchSites(): Promise<Site[]> {
  const { data } = await apiClient.get<{ sites: Site[] }>("/sites");
  return data.sites;
}

export async function fetchSite(siteId: string): Promise<SiteDetail> {
  const { data } = await apiClient.get<SiteDetail>(`/sites/${siteId}`);
  return data;
}

export async function fetchUnit(unitId: string): Promise<Unit> {
  const { data } = await apiClient.get<Unit>(`/units/${unitId}`);
  return data;
}

export async function fetchAlerts(unitId: string): Promise<Alert[]> {
  const { data } = await apiClient.get<{ alerts: Alert[] }>(`/units/${unitId}/alerts`);
  return data.alerts;
}
