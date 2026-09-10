import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
) {
  try {
    const {
      user,
      email,
    } =
      await requireAdmin(request);

    return Response.json(
      {
        ok: true,
        admin: {
          userId: user.id,
          email,
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error: unknown) {
    return adminErrorResponse(
      error,
    );
  }
}
