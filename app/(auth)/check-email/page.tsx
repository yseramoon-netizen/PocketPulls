import CheckEmailClient from "@/components/auth/CheckEmailClient";
import { normaliseNextPath } from "@/lib/auth/navigation";

type CheckEmailPageProps = {
  searchParams: Promise<{
    email?: string | string[];
    next?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function CheckEmailPage({
  searchParams,
}: CheckEmailPageProps) {
  const query = await searchParams;
  const initialEmail = firstValue(query.email).trim().toLowerCase();
  const initialNextPath = normaliseNextPath(firstValue(query.next));

  return (
    <CheckEmailClient
      initialEmail={initialEmail}
      initialNextPath={initialNextPath}
    />
  );
}
