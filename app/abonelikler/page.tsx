import type { Metadata } from "next";
import SubscriptionsPage from "@/components/subscriptions/subscriptions-page";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Abonelikler",
  description: "Aboneliklerini ve ödeme tarihlerini takip et.",
};

export default function Abonelikler() {
  return <SubscriptionsPage vapidPublicKey={env.vapidPublicKey()} />;
}
