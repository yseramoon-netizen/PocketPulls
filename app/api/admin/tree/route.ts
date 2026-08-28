import {
  adminErrorResponse,
  requireFounderAdmin,
  type ServerAdminClient,
} from "@/lib/admin/server-auth";
import {
  applyPersistentGrowth,
  loadGrowthSnapshot,
} from "@/lib/admin/growth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type TreeStateRow = {
  high_water_score?: unknown;
  visit_count?: unknown;
};

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function rememberTreeGrowth(
  admin: ServerAdminClient,
  score: number,
  countVisit: boolean,
): Promise<{
  highWaterScore: number;
  gardenVisits: number;
} | null> {
  try {
    const result = await (
      admin as unknown as {
        rpc(
          name: string,
          parameters: Record<string, unknown>,
        ): Promise<{
          data: unknown;
          error: unknown;
        }>;
      }
    ).rpc(
      "record_shared_tree_growth",
      {
        p_score: Math.max(0, Math.round(score)),
        p_count_visit: countVisit,
      },
    );

    if (result.error) {
      console.warn(
        "Persistent shared-tree growth is unavailable:",
        result.error,
      );
      return null;
    }

    const rawRow = Array.isArray(result.data)
      ? result.data[0]
      : result.data;

    if (
      typeof rawRow !== "object" ||
      rawRow === null
    ) {
      return null;
    }

    const row = rawRow as TreeStateRow;

    return {
      highWaterScore: numberValue(
        row.high_water_score,
      ),
      gardenVisits: numberValue(
        row.visit_count,
      ),
    };
  } catch (error: unknown) {
    console.warn(
      "Persistent shared-tree growth failed:",
      error,
    );
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const {
      admin,
      email,
    } = await requireFounderAdmin(request);

    const rawTree = await loadGrowthSnapshot(admin);
    const url = new URL(request.url);
    const countVisit =
      url.searchParams.get("visit") === "1";
    const state = await rememberTreeGrowth(
      admin,
      rawTree.growthScore,
      countVisit,
    );
    const tree = state
      ? applyPersistentGrowth(
          rawTree,
          state.highWaterScore,
          state.gardenVisits,
        )
      : rawTree;

    return Response.json(
      {
        ok: true,
        viewerEmail: email,
        generatedAt: new Date().toISOString(),
        tree,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
