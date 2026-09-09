/**
 * Builds the normalized {@link FieldNode} tree the renderer consumes.
 *
 * Strategy (the "both, schema if present" choice):
 *   - When a JSON Schema descriptor is published, it drives field types,
 *     enums, numeric bounds, labels and ordering.
 *   - Any object keys present in the live value but missing from the schema are
 *     appended by introspecting their runtime type, so a stale/partial schema
 *     never hides real fields.
 *   - With no schema at all, the whole tree is inferred from the live value.
 */
import type { FieldKind, FieldNode, JSONSchema } from "./types";

function humanize(name: string): string {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Reads through Zod's anyOf/allOf wrappers (e.g. optional/default unions). */
function unwrap(schema: JSONSchema): JSONSchema {
  if (schema.anyOf?.length) {
    const concrete = schema.anyOf.find((s) => s.type && s.type !== "null");
    if (concrete) return { ...concrete, description: schema.description ?? concrete.description };
  }
  if (schema.allOf?.length === 1) return { ...schema.allOf[0], description: schema.description };
  return schema;
}

function schemaType(schema: JSONSchema): string | undefined {
  const t = schema.type;
  if (Array.isArray(t)) return t.find((x) => x !== "null");
  return t;
}

function arrayIsStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/** Infers a leaf/branch node purely from a runtime value. */
function fromValue(name: string, path: string[], value: unknown): FieldNode {
  const label = humanize(name);

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const children = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => fromValue(k, [...path, k], v)
    );
    return { name, path, label, kind: "object", children };
  }

  let kind: FieldKind = "json";
  if (typeof value === "boolean") kind = "boolean";
  else if (typeof value === "number") kind = "number";
  else if (typeof value === "string") kind = "string";
  else if (arrayIsStrings(value)) kind = "stringArray";

  return { name, path, label, kind };
}

/** Builds a node from schema, pulling current values from `value` as needed. */
function fromSchema(
  name: string,
  path: string[],
  rawSchema: JSONSchema,
  value: unknown
): FieldNode {
  const schema = unwrap(rawSchema);
  const label = schema.title ? schema.title : humanize(name);
  const description = schema.description;
  const type = schemaType(schema);

  if (schema.enum?.length) {
    return { name, path, label, description, kind: "enum", options: schema.enum };
  }

  if (type === "object" && schema.properties) {
    const obj = (value ?? {}) as Record<string, unknown>;
    const seen = new Set<string>();
    const children: FieldNode[] = [];

    for (const [k, childSchema] of Object.entries(schema.properties)) {
      seen.add(k);
      children.push(fromSchema(k, [...path, k], childSchema, obj[k]));
    }
    // Surface value-only keys the schema doesn't describe.
    for (const [k, v] of Object.entries(obj)) {
      if (!seen.has(k)) children.push(fromValue(k, [...path, k], v));
    }
    return { name, path, label, description, kind: "object", children };
  }

  if (type === "boolean") return { name, path, label, description, kind: "boolean" };
  if (type === "integer" || type === "number") {
    return {
      name,
      path,
      label,
      description,
      kind: "number",
      min: schema.minimum,
      max: schema.maximum,
    };
  }
  if (type === "string") return { name, path, label, description, kind: "string" };
  if (type === "array" && schemaType(unwrap(schema.items ?? {})) === "string") {
    return { name, path, label, description, kind: "stringArray" };
  }

  // Unknown / mixed: fall back to inferring from the live value.
  return { ...fromValue(name, path, value), label, description };
}

export function buildModel(
  value: Record<string, unknown>,
  schema?: JSONSchema
): FieldNode {
  if (schema && (schema.properties || schema.type === "object")) {
    return fromSchema("root", [], schema, value);
  }
  return fromValue("root", [], value);
}

/** Reads a value at a dotted path from a config object. */
export function getAtPath(root: unknown, path: string[]): unknown {
  return path.reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === "object"
        ? (acc as Record<string, unknown>)[key]
        : undefined,
    root
  );
}

/** Returns a deep-ish clone of `root` with `path` set to `value`. */
export function setAtPath<T extends Record<string, unknown>>(
  root: T,
  path: string[],
  value: unknown
): T {
  const [head, ...rest] = path;
  if (head === undefined) return value as T;
  const current = (root[head] ?? {}) as Record<string, unknown>;
  return {
    ...root,
    [head]: rest.length === 0 ? value : setAtPath(current, rest, value),
  };
}
