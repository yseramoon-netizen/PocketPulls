import { redirect } from "next/navigation";

export default function RetiredHistoryPage() {
  redirect("/constellation?panel=history");
}
