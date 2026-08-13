import { DuatApiError, duatErrorResponse, requireDuatUser } from "@/lib/player/endless-duat-server";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const { admin, user } = await requireDuatUser(request);
    const body = await request.json();
    if (!body?.state || typeof body.state !== "object") throw new DuatApiError("Invalid Duat progress.");
    const serialised = JSON.stringify(body.state);
    if (serialised.length > 128_000) throw new DuatApiError("Duat progress is too large.", 413);
    const { error } = await admin.from("player_duat_progress").upsert({
      user_id: user.id,
      state: body.state,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return duatErrorResponse(error);
  }
}
