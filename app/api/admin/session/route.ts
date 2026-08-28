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
      aal,
    } =
      await requireAdmin(request, {
        requireMfa: false,
      });

    return Response.json(
      {
        ok: true,
        admin: {
          userId: user.id,
          email,
          aal,
          mfaRequired: true,
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
