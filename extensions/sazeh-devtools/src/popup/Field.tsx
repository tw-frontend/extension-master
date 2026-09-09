import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { getAtPath } from "../core/model";
import type { FieldNode } from "../core/types";

const Text = {
  selectPlaceholder: "Select…",
  stringArrayPlaceholder: "One item per line",
} as const;

interface FieldProps {
  node: FieldNode;
  draft: Record<string, unknown>;
  onChange: (path: string[], value: unknown) => void;
  /** Lowercased search query; empty means "show all". */
  query: string;
}

function matches(node: FieldNode, query: string): boolean {
  if (!query) return true;
  if (node.path.join(".").toLowerCase().includes(query)) return true;
  return (node.children ?? []).some((c) => matches(c, query));
}

export function Field({ node, draft, onChange, query }: FieldProps) {
  if (!matches(node, query)) return null;

  if (node.kind === "object") {
    const isRoot = node.path.length === 0;
    return (
      <fieldset
        className={
          isRoot
            ? "space-y-3"
            : "rounded-lg border bg-card/40 px-3 pt-2 pb-3 space-y-1"
        }
      >
        {!isRoot && (
          <legend className="px-1 text-xs font-semibold text-primary">
            {node.label}
          </legend>
        )}
        {node.children?.map((child) => (
          <Field
            key={child.path.join(".")}
            node={child}
            draft={draft}
            onChange={onChange}
            query={query}
          />
        ))}
      </fieldset>
    );
  }

  const value = getAtPath(draft, node.path);
  const id = node.path.join(".");
  const stacked = node.kind === "stringArray" || node.kind === "json";

  return (
    <div
      className={
        stacked
          ? "space-y-1.5 py-1"
          : "flex items-center justify-between gap-3 py-1"
      }
    >
      <Label
        htmlFor={id}
        title={node.description}
        className="flex-col items-start gap-0.5 font-normal"
      >
        <span>{node.label}</span>
        <code className="text-[10px] font-normal text-muted-foreground">
          {id}
        </code>
      </Label>
      <Control id={id} node={node} value={value} onChange={onChange} />
    </div>
  );
}

function Control({
  id,
  node,
  value,
  onChange,
}: {
  id: string;
  node: FieldNode;
  value: unknown;
  onChange: (path: string[], value: unknown) => void;
}) {
  switch (node.kind) {
    case "boolean":
      return (
        <Switch
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(node.path, checked)}
        />
      );

    case "number":
      return (
        <Input
          id={id}
          type="number"
          className="w-32"
          min={node.min}
          max={node.max}
          value={value === undefined || value === null ? "" : Number(value)}
          onChange={(e) =>
            onChange(
              node.path,
              e.target.value === "" ? null : Number(e.target.value)
            )
          }
        />
      );

    case "enum":
      return (
        <Select
          value={String(value ?? "")}
          onValueChange={(next) => {
            const picked = node.options?.find((o) => String(o) === next);
            onChange(node.path, picked ?? next);
          }}
        >
          <SelectTrigger id={id} size="sm" className="w-40">
            <SelectValue placeholder={Text.selectPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {node.options?.map((opt) => (
              <SelectItem key={String(opt)} value={String(opt)}>
                {String(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "stringArray": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Textarea
          id={id}
          className="font-mono text-xs"
          rows={Math.min(Math.max(arr.length, 2), 8)}
          value={arr.join("\n")}
          placeholder={Text.stringArrayPlaceholder}
          onChange={(e) =>
            onChange(
              node.path,
              e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
        />
      );
    }

    case "json":
      return (
        <Textarea
          id={id}
          className="font-mono text-xs aria-invalid:border-destructive"
          rows={3}
          defaultValue={JSON.stringify(value, null, 2)}
          onBlur={(e) => {
            try {
              onChange(node.path, JSON.parse(e.target.value));
              e.target.removeAttribute("aria-invalid");
            } catch {
              e.target.setAttribute("aria-invalid", "true");
            }
          }}
        />
      );

    case "string":
    default:
      return (
        <Input
          id={id}
          type="text"
          className="w-44"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(node.path, e.target.value)}
        />
      );
  }
}
