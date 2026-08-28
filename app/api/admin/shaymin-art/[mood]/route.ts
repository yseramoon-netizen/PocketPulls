import { readFile } from "node:fs/promises";
import path from "node:path";

import { adminErrorResponse, requireFounderAdmin } from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ mood: string }>;
};

const PRIVATE_ART_MOODS = new Set([
  "gentle",
  "eager",
  "zoomies",
  "content",
  "joyful",
  "blooming",
  "playful",
  "curious",
  "surprised",
  "grumpy",
  "sad",
  "crying",
  "sleepy",
  "resting",
  "cheerful",
  "exploring",
  "determined",
  "shy",
]);

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireFounderAdmin(request);

    const params = await Promise.resolve(context.params);
    const mood = String(params.mood || "").toLowerCase().trim();

    if (!PRIVATE_ART_MOODS.has(mood)) {
      return new Response("Not found", { status: 404 });
    }

    const bytes = await readFile(
      path.join(process.cwd(), "private-assets", "shaymin", `${mood}.png`),
    );

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=3600",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
