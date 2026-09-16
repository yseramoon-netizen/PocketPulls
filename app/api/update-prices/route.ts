export { POST } from "../prices/refresh/route";
export async function GET() {
  return Response.json({error:"Use the authenticated price refresh action in Administration."}, {status:405,headers:{Allow:"POST","Cache-Control":"no-store"}});
}
