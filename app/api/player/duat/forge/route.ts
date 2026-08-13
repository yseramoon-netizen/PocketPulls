import { duatErrorResponse, requireDuatUser } from "@/lib/player/endless-duat-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { admin, user } = await requireDuatUser(request);
    const { data, error } = await admin.rpc("forge_endless_duat_fragment", { p_user_id: user.id });
    if (error) throw error;
    return Response.json({ ok: true, ...(Array.isArray(data) ? data[0] : data) });
  } catch (error) {
    return duatErrorResponse(error);
  }
}
