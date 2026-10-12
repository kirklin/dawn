import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { searchPlaces } from "~/lib/places/geocode";

const querySchema = z.object({ q: z.string().trim().min(1).max(40) });

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({ q: request.nextUrl.searchParams.get("q") });
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  return NextResponse.json({ results: await searchPlaces(parsed.data.q) });
}
