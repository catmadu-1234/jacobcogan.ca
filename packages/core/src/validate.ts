import { z } from "zod";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES } from "./types";
import { slugify } from "./slug";

const httpUrl = z
  .string()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be an http(s) link");

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const variant = z.enum(["original", "w480", "w1200", "w2400", "poster"]);

export const FieldDefInput = z.object({
  label: z.string().trim().min(1).max(60),
  type: z.enum(["text", "longtext", "url"]),
  required: z.boolean(),
});
export type FieldDefInput = z.infer<typeof FieldDefInput>;

export const SitePatch = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  about: z.string().max(5000).optional(),
  links: z.array(z.object({ label: z.string().trim().min(1).max(40), url: httpUrl })).max(10).optional(),
  theme: z
    .object({
      preset: z.enum(["grotesk", "serif-title"]),
      accent: hexColor,
      rowHeight: z.number().int().min(160).max(560),
      showIndexCaptions: z.boolean(),
    })
    .partial()
    .optional(),
});
export type SitePatch = z.infer<typeof SitePatch>;

export const WorkPatch = z.object({
  title: z.string().max(200).optional(),
  slug: z.string().max(200).transform(slugify).refine((s) => s.length >= 1 && s.length <= 80).optional(),
  visible: z.boolean().optional(),
  fields: z.record(z.string(), z.string().max(10000)).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  coverMediaId: z.number().int().nullable().optional(),
  expectedUpdatedAt: z.string().min(1),
});
export type WorkPatch = z.infer<typeof WorkPatch>;

export const MediaCreate = z.object({
  kind: z.enum(["image", "video"]),
  mime: z.enum(ALLOWED_MIME),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  duration: z.number().nonnegative().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/).optional(),
  bytes: z.number().int().nonnegative().max(MAX_UPLOAD_BYTES),
  variants: z.array(variant).min(1),
});
export type MediaCreate = z.infer<typeof MediaCreate>;

export const MediaPatch = z.object({
  alt: z.string().max(500).optional(),
  status: z.literal("ready").optional(),
});
export type MediaPatch = z.infer<typeof MediaPatch>;

export const IdList = z.array(z.number().int());
export type IdList = z.infer<typeof IdList>;
