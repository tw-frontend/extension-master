import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import {
  clearOverride,
  reloadActiveTab,
  saveOverride,
  scanActiveTab,
} from "../core/bridge";
import { buildModel, setAtPath } from "../core/model";
import type { PageScan } from "../core/types";
import { Field } from "./Field";

type Status = { kind: "info" | "error"; text: string } | null;

const Text = {
  title: "Sazeh DevTools",
  schemaBadge: "schema",
  schemaBadgeTitle: "Schema descriptor found",
  inferredBadge: "inferred",
  inferredBadgeTitle: "No schema; inferred from value",
  refresh: "Refresh",
  emptyState: "No Sazeh config found on this tab.",
  emptyStateHintPrefix: "Open a page where Sazeh has run (a",
  emptyStateHintKey: "tw-sazeh-*",
  emptyStateHintSuffix: "key in localStorage), then hit Refresh.",
  filterPlaceholder: "Filter fields…",
  keepOverride: "Keep override",
  keepOverrideTitle:
    "Pin staleAt far ahead so the app's stale-while-revalidate won't overwrite your override on reload",
  revert: "Revert",
  reset: "Reset",
  saveAndReload: "Save & Reload",
  savedStatus: "Saved & reloaded the page.",
  clearedStatus: "Cleared override; page will refetch.",
} as const;

export function App() {
  const [scan, setScan] = useState<PageScan | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState("");
  const [pin, setPin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    const result = await scanActiveTab();
    setScan(result);
    const first = result.entries[0];
    setSelectedKey(first?.key ?? "");
    setDraft(first ? structuredClone(first.value) : {});
    setDirty(false);
    setBusy(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const entry = useMemo(
    () => scan?.entries.find((e) => e.key === selectedKey),
    [scan, selectedKey],
  );

  const model = useMemo(
    () => (entry ? buildModel(entry.value, entry.schema) : null),
    [entry],
  );

  const selectEntry = (key: string) => {
    const next = scan?.entries.find((e) => e.key === key);
    setSelectedKey(key);
    setDraft(next ? structuredClone(next.value) : {});
    setDirty(false);
    setStatus(null);
  };

  const handleChange = useCallback((path: string[], value: unknown) => {
    setDraft((prev) => setAtPath(prev, path, value));
    setDirty(true);
  }, []);

  const revert = () => {
    if (entry) setDraft(structuredClone(entry.value));
    setDirty(false);
    setStatus(null);
  };

  const save = async () => {
    if (!entry) return;
    setBusy(true);
    try {
      await saveOverride(entry.key, draft, pin);
      await reloadActiveTab();
      setStatus({ kind: "info", text: Text.savedStatus });
      setDirty(false);
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!entry) return;
    setBusy(true);
    try {
      await clearOverride(entry.key);
      await reloadActiveTab();
      setStatus({ kind: "info", text: Text.clearedStatus });
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex max-h-[560px] w-[480px] flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {Text.title}
          {entry?.schema ? (
            <Badge variant="secondary" title={Text.schemaBadgeTitle}>
              {Text.schemaBadge}
            </Badge>
          ) : entry ? (
            <Badge variant="outline" title={Text.inferredBadgeTitle}>
              {Text.inferredBadge}
            </Badge>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void load()}
          disabled={busy}
          title={Text.refresh}
        >
          <RefreshCw className={busy ? "animate-spin" : undefined} />
        </Button>
      </header>
      <Separator />

      {!entry ? (
        <div className="space-y-2 px-4 py-8 text-center">
          <p className="text-sm">{Text.emptyState}</p>
          <p className="text-xs text-muted-foreground">
            {Text.emptyStateHintPrefix}{" "}
            <code className="font-mono">{Text.emptyStateHintKey}</code>{" "}
            {Text.emptyStateHintSuffix}
          </p>
          {scan?.url && (
            <p className="pt-2 text-xs break-all text-muted-foreground">
              {scan.url}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 px-3 py-2.5">
            {scan && scan.entries.length > 1 ? (
              <Select value={selectedKey} onValueChange={selectEntry}>
                <SelectTrigger size="sm" className="max-w-[50%]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scan.entries.map((e) => (
                    <SelectItem key={e.key} value={e.key}>
                      {e.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <code className="truncate text-[11px] text-muted-foreground">
                {entry.key}
              </code>
            )}
            <Input
              type="search"
              placeholder={Text.filterPlaceholder}
              className="h-8 flex-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Separator />

          <div className="flex-1 overflow-auto px-3 py-3">
            {model && (
              <Field
                node={model}
                draft={draft}
                onChange={handleChange}
                query={query.trim().toLowerCase()}
              />
            )}
          </div>

          {status && (
            <div
              className={`mx-3 mb-2 rounded-md px-3 py-1.5 text-xs ${
                status.kind === "error"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-primary/10 text-foreground"
              }`}
            >
              {status.text}
            </div>
          )}

          <Separator />
          <footer className="flex items-center justify-between gap-2 px-3 py-2.5">
            <Label
              htmlFor="pin"
              className="gap-1.5 text-xs font-normal text-muted-foreground"
              title={Text.keepOverrideTitle}
            >
              <Switch id="pin" checked={pin} onCheckedChange={setPin} />
              {Text.keepOverride}
            </Label>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={revert}
                disabled={!dirty || busy}
              >
                <RotateCcw /> {Text.revert}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => void reset()}
                disabled={busy}
              >
                <Trash2 /> {Text.reset}
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={busy}>
                <Save /> {Text.saveAndReload}
              </Button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
