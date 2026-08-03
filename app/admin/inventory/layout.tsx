import type { ReactNode } from "react";

type InventoryLayoutProps = {
  children: ReactNode;
};

export default function InventoryLayout({
  children,
}: InventoryLayoutProps) {
  return <>{children}</>;
}