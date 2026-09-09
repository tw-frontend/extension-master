import { z } from "zod";

export const browserSchema = z.enum(["chrome", "edge", "firefox", "safari", "brave", "opera"]);
export type Browser = z.infer<typeof browserSchema>;

export const extensionStatusSchema = z.enum(["stable", "beta", "alpha", "wip", "archived"]);
export type ExtensionStatus = z.infer<typeof extensionStatusSchema>;

export const extensionConfigSchema = z.object({
  /** Slug — must match the folder name under extensions/. */
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "id must be kebab-case"),
  name: z.string().min(1),
  shortDescription: z.string().min(1).max(160),
  description: z.string().min(1),
  /** Must match the extension package.json version (and the manifest version). */
  version: z.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/, "version must be semver"),
  status: extensionStatusSchema,
  /** Path to the icon file, relative to the extension folder. */
  icon: z.string().min(1),
  browserSupport: z.array(browserSchema).min(1),
  categories: z.array(z.string().min(1)).min(1),
  /** Path inside this repository, e.g. "extensions/openrouter-deals". */
  repositoryPath: z.string().min(1),
  screenshots: z.array(z.string()).default([]),
  features: z.array(z.string().min(1)).default([]),
  /** Structured install steps; the UI adds the standard Chrome unpacked flow. */
  installInstructions: z.array(z.string().min(1)).default([]),
  permissions: z.array(z.string()).default([]),
  hostPermissions: z.array(z.string()).default([]),
  build: z.object({
    /** Directory containing the production build. "." when source == build. */
    outputDir: z.string().min(1),
    /** Optional pnpm script name to run for the build (skipped when omitted). */
    command: z.string().optional(),
    /** Top-level entries (relative to outputDir) excluded from the ZIP. */
    exclude: z.array(z.string()).default([]),
  }),
  /** Optional override for the "View source" link (defaults to repo + repositoryPath). */
  sourceUrl: z.string().url().optional(),
});

export type ExtensionConfig = z.infer<typeof extensionConfigSchema>;
