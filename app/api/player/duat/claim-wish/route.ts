import { DuatApiError, duatErrorResponse, requireDuatUser } from "@/lib/player/endless-duat-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { admin, user } = await requireDuatUser(request);
    const body = await request.json();
    const idempotencyKey = String(body?.idempotencyKey || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      throw new DuatApiError("Invalid wish claim key.");
    }
    const { data, error } = await admin.rpc("claim_endless_duat_wish", {
      p_user_id: user.id,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw error;
    return Response.json({ ok: true, ...(Array.isArray(data) ? data[0] : data) });
  } catch (error) {
    return duatErrorResponse(error);
  }
}
