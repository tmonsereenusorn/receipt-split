import type { Metadata } from "next";
import { getReceipt } from "@/lib/firestore";
import ReceiptPageClient from "./ReceiptPageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const receipt = await getReceipt(id);
  const name = receipt?.restaurantName;
  const title = name ? `${name} Shplit` : "Shplit";

  return {
    title,
    description: name
      ? `Split the bill from ${name} with friends`
      : "Split receipts with friends",
  };
}

export default async function CollaborativeReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReceiptPageClient id={id} />;
}
