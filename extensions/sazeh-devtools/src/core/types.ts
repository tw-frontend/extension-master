/**
 * Shared types for the Sazeh DevTools popup.
 *
 * The extension never imports the app's Zod schema directly (it must stay a
 * standalone, installable artifact). Instead it works off two runtime inputs
 * read from the inspected page's localStorage:
 *   1. the live config value (always present once Sazeh has run), and
 *   2. an optional JSON Schema descriptor published under `${key}__schema`.
 *
 * The field model below is the common shape both inputs are normalized into so
 * the renderer doesn't care where the type information came from.
 */

/** Mirrors the envelope written by `@tw-frontend/sazeh-ui`'s StorageService. */
export interface SazehEnvelopeMeta {
  /** Hard-expiry timestamp (ms). */
  ttl?: number;
  /** Soft staleness boundary (ms). */
  staleAt?: number;
}

/** One discovered `tw-sazeh-*` config entry on the page. */
export interface SazehEntry {
  /** localStorage key, e.g. `tw-sazeh-web-1.0.0`. */
  key: string;
  /** The unwrapped config object (envelope `value`, or the raw value). */
  value: Record<string, unknown>;
  /** Envelope metadata, if the stored value was an envelope. */
  meta: SazehEnvelopeMeta;
  /** Optional JSON Schema descriptor found at `${key}__schema`. */
  schema?: JSONSchema;
}

/** Everything the popup needs after one read of the active tab. */
export interface PageScan {
  url: string | null;
  entries: SazehEntry[];
  /** Set when the page is reachable but no Sazeh key exists yet. */
  empty: boolean;
}

export type FieldKind =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "stringArray"
  | "object"
  | "json";

/** A node in the normalized, renderable field tree. */
export interface FieldNode {
  /** Last path segment (the property name). */
  name: string;
  /** Full path from the config root, e.g. ["contact", "email"]. */
  path: string[];
  label: string;
  kind: FieldKind;
  description?: string;
  /** enum options (kind === "enum"). */
  options?: (string | number)[];
  /** numeric bounds (kind === "number"). */
  min?: number;
  max?: number;
  /** child fields (kind === "object"). */
  children?: FieldNode[];
}

/** Minimal subset of JSON Schema we consume (output of `z.toJSONSchema`). */
export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  description?: string;
  title?: string;
  default?: unknown;
  // Zod sometimes wraps with these; we read through them.
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
}
