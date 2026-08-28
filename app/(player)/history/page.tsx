import { redirect } from "next/navigation";

export default function HistoryRedirect() {
  redirect("/constellation?archive=latest");
}
