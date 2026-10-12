import { z } from "zod";

const decimal = z.string().regex(/^-?\d+(?:\.\d+)?$/).transform(Number);

export const latLonSchema = z.object({
  lat: decimal.pipe(z.number().min(-90).max(90)),
  lon: decimal.pipe(z.number().min(-180).max(180)),
});

export const placeParamsSchema = latLonSchema.extend({
  name: z.string().trim().min(1).max(80),
  detail: z.string().trim().max(160).optional(),
  current: z.literal("1").optional(),
  preview: z.literal("1").optional(),
});

export type PlaceParams = z.infer<typeof placeParamsSchema>;
