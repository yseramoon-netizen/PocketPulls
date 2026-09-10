import { redirect } from "next/navigation";

export default function RetiredTradePage() {
  redirect("/friends?panel=trade");
}
