import Studio from "@/components/studio"
import { notFound } from "next/navigation"
import collections from "@/lib/collections.json"
import catalog from "@/lib/catalog.json"
import projects from "@/lib/projects.json"
const routes = new Set([
  "/shop",
  "/shop/prints",
  "/info",
  "/auctions",
  "/wishlist",
  "/account",
  "/sign-in",
  "/create-account",
  "/forgot-password",
  "/privacy",
  "/terms",
  "/shipping",
  ...collections.flatMap((c) => [
    `/collection/${c.slug}`,
    `/shop/prints/${c.slug}`,
  ]),
  ...catalog.flatMap((p) => [p.href, `${p.href}/ar`]),
  ...projects.map((p) => p.href),
])
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const path = "/" + (await params).slug.join("/")
  if (!routes.has(path)) notFound()
  return <Studio />
}
