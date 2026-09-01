export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
} as const;

export async function GET() {
  return Response.json(
    {
      ok: true,
      service: "ancient-pulls",
      release: process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "67.15",
      timestamp: new Date().toISOString(),
    },
    { headers: RESPONSE_HEADERS },
  );
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: RESPONSE_HEADERS,
  });
}
