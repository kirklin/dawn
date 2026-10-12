import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlaceForecast } from "~/lib/forecast/place-forecast";
import { summarizePlace } from "~/lib/forecast/summary";
import { latLonSchema } from "~/lib/places/params";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const parsed = latLonSchema.safeParse({ lat: searchParams.get("lat"), lon: searchParams.get("lon") });
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const now = Date.now();
  return NextResponse.json(summarizePlace(await getPlaceForecast(parsed.data, now), now));
}
