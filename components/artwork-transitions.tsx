"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  cancelArtworkTransition,
  imageCorners,
  imageClip,
  openArtwork,
  findArtworkSource,
  returnArtwork,
} from "@/lib/artwork-transition"
import catalog from "@/lib/catalog.json"
import collections from "@/lib/collections.json"
const products = new Set(catalog.map((p) => p.href))
const returnRoutes = new Set([
  "/",
  "/shop",
  "/shop/prints",
  ...collections.flatMap((c) => [
    `/shop/prints/${c.slug}`,
    `/collection/${c.slug}`,
  ]),
])
function leavingArtwork() {
  const image = document.querySelector<HTMLImageElement>("[data-artwork-main]")
  if (!image?.complete || !image.naturalWidth) return null
  return {
    href: image.dataset.artworkHref!,
    src: image.currentSrc || image.src,
    alt: image.alt,
    ratio: image.naturalWidth / image.naturalHeight,
    key: image.dataset.artworkKey,
    corners: imageCorners(image),
    clip: imageClip(image),
    conceal: () => {
      const opacity = image.style.opacity
      image.style.opacity = "0"
      return () => {
        image.style.opacity = opacity
      }
    },
  }
}

// One persistent handler covers poster links in lists, search, saved work,
// related products and future pages without per-card transition plumbing.
export default function ArtworkTransitions() {
  const router = useRouter()
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const element = event.target instanceof Element ? event.target : null
      const link = element?.closest<HTMLAnchorElement>("a[href]")
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return
      const url = new URL(link.href, location.href)
      if (
        url.origin === location.origin &&
        url.pathname !== location.pathname &&
        returnRoutes.has(url.pathname)
      ) {
        const source = leavingArtwork()
        if (source) {
          event.preventDefault()
          event.stopPropagation()
          router.prefetch(url.pathname)
          returnArtwork(source, url.pathname + url.search, (href) =>
            router.push(href)
          )
          return
        }
      }
      if (
        url.origin !== location.origin ||
        !products.has(url.pathname) ||
        url.pathname === location.pathname
      )
        return
      const image = link.querySelector<HTMLImageElement>("img")
      const sceneSource = !image ? findArtworkSource(url.pathname) : null
      if (!sceneSource && (!image || !image.complete || !image.naturalWidth))
        return
      event.preventDefault()
      event.stopPropagation()
      router.prefetch(url.pathname)
      if (sceneSource) {
        openArtwork(sceneSource, (href) => router.push(href))
        return
      }
      if (!image) return
      openArtwork(
        {
          href: url.pathname,
          src: image.currentSrc || image.src,
          alt: image.alt,
          corners: imageCorners(image),
          clip: imageClip(image),
          conceal: () => {
            const opacity = image.style.opacity
            image.style.opacity = "0"
            return () => {
              image.style.opacity = opacity
            }
          },
        },
        (href) => router.push(href)
      )
    }
    const pop = () => {
      const source = leavingArtwork()
      if (source && returnRoutes.has(location.pathname))
        returnArtwork(source, location.pathname + location.search, () => {})
      else cancelArtworkTransition()
    }
    document.addEventListener("click", click, true)
    window.addEventListener("popstate", pop)
    window.addEventListener("resize", pop)
    return () => {
      document.removeEventListener("click", click, true)
      window.removeEventListener("popstate", pop)
      window.removeEventListener("resize", pop)
      cancelArtworkTransition()
    }
  }, [router])
  return null
}
