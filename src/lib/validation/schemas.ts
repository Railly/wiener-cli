import { z } from "zod";

export const IntranetCredentialsSchema = z.object({
  usuario: z.string().min(1).max(20),
  contrasena: z.string().min(1),
  perfil: z.enum(["A", "D", "P"]),
});

export const CanvasPatSchema = z.object({
  token: z.string().min(10),
});

export const CourseRefSchema = z.string().min(1).max(100);

export const PeriodoSchema = z.string().regex(/^\d{4}-[I|II|III]$/, "Format: YYYY-I or YYYY-II");

export const CommandListSchema = z.array(z.string());

export const OkEnvelopeSchema = z.object({
  ok: z.literal(true),
  data: z.unknown(),
  meta: z
    .object({
      duration_ms: z.number().optional(),
      rate_limit_remaining: z.number().optional(),
      from_cache: z.boolean().optional(),
    })
    .optional(),
});

export const ErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    hint: z.string().optional(),
    details: z.unknown().optional(),
  }),
});

export const EnvelopeSchema = z.discriminatedUnion("ok", [OkEnvelopeSchema, ErrorEnvelopeSchema]);

export type IntranetCredentialsInput = z.infer<typeof IntranetCredentialsSchema>;
