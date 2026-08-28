import { redirect } from "next/navigation";

export default function ShippingRedirect() {
  redirect("/orders?panel=shipping");
}
