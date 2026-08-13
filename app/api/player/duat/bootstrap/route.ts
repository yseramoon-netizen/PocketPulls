import { isNebuSkinKey } from "@/lib/player/nebu";
import { duatErrorResponse, requireDuatUser, resolvePrivateDuatSkins } from "@/lib/player/endless-duat-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACHIEVEMENT_SKINS: Record<string, string> = {
  first_wish: "nile",
  collector_25: "lotus",
  rare_first: "scarab",
  streak_7: "sunstone",
  constellation_keeper: "royal",
  rare_twenty: "pearl",
};

export async function GET(request: Request) {
  try {
    const { admin, user } = await requireDuatUser(request);
    const [wallet, achievements, cosmic, account, progress] = await Promise.all([
      admin.from("player_wallets").select("wish_balance").eq("user_id", user.id).maybeSingle(),
      admin.from("player_achievements").select("achievement_key").eq("user_id", user.id).not("unlocked_at", "is", null),
      admin.from("cosmic_nebu_ownerships").select("issue_number").eq("user_id", user.id).maybeSingle(),
      admin.from("player_duat_accounts").select("active_seconds,forge_fragments").eq("user_id", user.id).maybeSingle(),
      admin.from("player_duat_progress").select("state").eq("user_id", user.id).maybeSingle(),
    ]);
    const owned = new Set<string>(["midnight", ...resolvePrivateDuatSkins(user)]);
    for (const row of achievements.data || []) {
      const skin = ACHIEVEMENT_SKINS[String(row.achievement_key)];
      if (skin) owned.add(skin);
    }
    if (cosmic.data?.issue_number) owned.add("cosmic_nebu");
    const metadataSkin = user.user_metadata?.nebu_skin;
    const selectedSkin = isNebuSkinKey(metadataSkin) && owned.has(metadataSkin) ? metadataSkin : "midnight";
    return Response.json({
      ok: true,
      state: progress.data?.state || null,
      ownedSkins: [...owned],
      selectedSkin,
      fragments: Number(account.data?.forge_fragments) || 0,
      activeSeconds: Number(account.data?.active_seconds) || 0,
      wishBalance: Number(wallet.data?.wish_balance) || 0,
      cosmicIssueNumber: cosmic.data?.issue_number || null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return duatErrorResponse(error);
  }
}
