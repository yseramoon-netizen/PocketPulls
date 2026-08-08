import { PRIVATE_SHAYMIN_ART } from "@/lib/admin/private-shaymin-art-data";
import { adminErrorResponse, requireAdmin } from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ mood: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAdmin(request);

    const params = await Promise.resolve(context.params);
    const mood = String(params.mood || "").toLowerCase().trim();
    const encoded = PRIVATE_SHAYMIN_ART[mood];

    if (!encoded) {
      return new Response("Not found", { status: 404 });
    }

    const bytes = Buffer.from(encoded, "base64");

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
