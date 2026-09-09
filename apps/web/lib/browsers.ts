import type { Browser } from "@extensions-hub/extension-registry";

export const BROWSER_NAMES: Record<Browser, string> = {
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  safari: "Safari",
  brave: "Brave",
  opera: "Opera",
};

export function browserLabel(browser: string): string {
  return BROWSER_NAMES[browser as Browser] ?? browser;
}
