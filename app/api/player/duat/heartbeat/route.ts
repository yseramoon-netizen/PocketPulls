import { duatErrorResponse, requireDuatUser } from "@/lib/player/endless-duat-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { admin, user } = await requireDuatUser(request);
    const body = await request.json().catch(() => ({}));
    const elapsedSeconds = Math.max(0, Math.min(45, Math.floor(Number(body.elapsedSeconds) || 0)));
    const { data, error } = await admin.rpc("record_endless_duat_heartbeat", {
      p_user_id: user.id,
      p_elapsed_seconds: elapsedSeconds,
    });
    if (error) throw error;
    return Response.json({ ok: true, ...(Array.isArray(data) ? data[0] : data) });
  } catch (error) {
    return duatErrorResponse(error);
  }
}
