import {
  createClient,
  type User,
} from "@supabase/supabase-js";

type AuthErrorLike = {
  message?: string;
  status?: number;
  code?: string;
};

type AuthResult<T> = Promise<{
  data: T;
  error: AuthErrorLike | null;
}>;

export type ServerAdminClient = {
  auth: {
    getUser(
      token?: string,
    ): AuthResult<{
      user: User | null;
    }>;

    resend(
      credentials: {
        type: "signup";
        email: string;
        options?: {
          emailRedirectTo?: string;
        };
      },
    ): AuthResult<Record<string, unknown>>;

    admin: {
      getUserById(
        userId: string,
      ): AuthResult<{
        user: User | null;
      }>;

      listUsers(
        parameters?: {
          page?: number;
          perPage?: number;
        },
      ): AuthResult<{
        users: User[];
        aud?: string;
      }>;
    };
  };

  from(
    relation: string,
  ): any;

  rpc(
    functionName: string,
    arguments_?:
      | Record<string, unknown>
      | undefined,
  ): Promise<{
    data: any;
    error: any;
  }>;
};

export type AdminContext = {
  user: User;
  email: string;
  admin: ServerAdminClient;
};

export class AdminAccessError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    message: string,
    status = 401,
    code = "admin_unauthorised",
  ) {
    super(message);
    this.name = "AdminAccessError";
    this.status = status;
    this.code = code;
  }
}

function requireEnvironment(
  names: string[],
): string {
  for (const name of names) {
    const value = process.env[name];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  throw new AdminAccessError(
    `Missing server environment value: ${names.join(
      " or ",
    )}.`,
    500,
    "admin_server_misconfigured",
  );
}

export function getAdminClient():
  ServerAdminClient {
  const url = requireEnvironment([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
  ]);

  const serviceKey = requireEnvironment([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
  ]);

  return createClient(
    url,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  ) as unknown as ServerAdminClient;
}

function getBearerToken(
  request: Request,
): string {
  const authorization =
    request.headers.get("authorization") || "";

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i,
    );

  const token = match?.[1]?.trim();

  if (!token) {
    throw new AdminAccessError(
      "Your admin session is missing. Sign in again.",
      401,
      "admin_session_missing",
    );
  }

  return token;
}

function getConfiguredAdminEmails(): Set<string> {
  const configured = [
    "pullspocket@gmail.com",
    ...(process.env.ADMIN_EMAILS || "")
      .split(","),
  ];

  return new Set(
    configured
      .map((email) =>
        email.trim().toLowerCase(),
      )
      .filter(Boolean),
  );
}

async function isDatabaseAdmin(
  admin: ServerAdminClient,
  user: User,
  email: string,
): Promise<boolean> {
  const table =
    admin.from(
      "admin_users",
    ) as any;

  const byUserId =
    await table
      .select(
        "email,user_id,is_active",
      )
      .eq(
        "user_id",
        user.id,
      )
      .eq(
        "is_active",
        true,
      )
      .maybeSingle();

  if (
    !byUserId.error &&
    byUserId.data
  ) {
    return true;
  }

  const byEmail =
    await table
      .select(
        "email,user_id,is_active",
      )
      .eq(
        "email",
        email,
      )
      .eq(
        "is_active",
        true,
      )
      .maybeSingle();

  if (
    !byEmail.error &&
    byEmail.data
  ) {
    const existingUserId =
      typeof byEmail.data
        .user_id === "string"
        ? byEmail.data
            .user_id
        : null;

    if (
      !existingUserId ||
      existingUserId !==
        user.id
    ) {
      const bindResult =
        await table
          .update({
            user_id:
              user.id,
            last_verified_at:
              new Date()
                .toISOString(),
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "email",
            email,
          );

      if (
        bindResult.error
      ) {
        console.warn(
          "Admin account binding failed:",
          bindResult.error,
        );
      }
    }

    return true;
  }

  /*
   * Founder and optional environment allowlist
   * remain a safe bootstrap path. Every other
   * administrator is managed through admin_users.
   */
  if (
    getConfiguredAdminEmails().has(
      email,
    )
  ) {
    if (
      byEmail.error &&
      !String(
        byEmail.error.message || "",
      )
        .toLowerCase()
        .includes(
          "admin_users",
        )
    ) {
      console.warn(
        "Admin allowlist lookup failed:",
        byEmail.error,
      );
    }

    return true;
  }

  return false;
}

export async function requireAdmin(
  request: Request,
): Promise<AdminContext> {
  const token =
    getBearerToken(request);

  const admin =
    getAdminClient();

  const {
    data,
    error,
  } =
    await admin.auth.getUser(
      token,
    );

  if (
    error ||
    !data.user
  ) {
    console.warn(
      "Admin token verification failed:",
      error?.message ||
        "No user returned.",
    );

    throw new AdminAccessError(
      "Your admin session expired or could not be verified. Sign in again.",
      401,
      "admin_session_invalid",
    );
  }

  const email =
    data.user.email
      ?.trim()
      .toLowerCase() || "";

  if (!email) {
    throw new AdminAccessError(
      "This Supabase account has no email address.",
      403,
      "admin_email_missing",
    );
  }

  const allowed =
    await isDatabaseAdmin(
      admin,
      data.user,
      email,
    );

  if (!allowed) {
    throw new AdminAccessError(
      `${email} is signed in but does not have active Shaymin administrator access.`,
      403,
      "admin_email_not_allowed",
    );
  }

  return {
    user: data.user,
    email,
    admin,
  };
}

export function adminErrorResponse(
  error: unknown,
) {
  if (
    error instanceof AdminAccessError
  ) {
    return Response.json(
      {
        ok: false,
        error: {
          code:
            error.code,
          message:
            error.message,
        },
      },
      {
        status:
          error.status,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const message =
    error instanceof Error &&
    error.message.trim()
      ? error.message.trim()
      : "The admin request failed.";

  console.error(
    "Unknown admin route error:",
    error,
  );

  return Response.json(
    {
      ok: false,
      error: {
        code:
          "admin_request_failed",
        message,
      },
    },
    {
      status: 500,
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}
