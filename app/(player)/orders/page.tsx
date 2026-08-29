import { redirect } from "next/navigation";

export default function RetiredOrdersPage() {
  redirect("/shipping#orders");
}
