
import { api } from "./api";
 
export function getApiBaseUrl(): string {
  return api.defaults.baseURL ?? "";
}
 
export function checkApiHealth(): Promise<void> {
  return api.get("/health/").then(() => undefined);
}
 