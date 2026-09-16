/** Retired: balances and inventory must only be changed by make_player_wish. */
export async function POST() {
  return Response.json({ok:false,error:{code:"legacy_pull_retired",message:"This wish endpoint has retired. Refresh the app and make your wish from Wishes."}}, {status:410,headers:{"Cache-Control":"no-store"}});
}
