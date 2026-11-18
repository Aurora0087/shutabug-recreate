"use client"

export type Point = { x: number; y: number }
export type ArtworkSource = {
  href: string
  src: string
  alt: string
  corners: [Point, Point, Point, Point]
  ratio?: number
  key?: string
  clip?: string
  conceal?: () => () => void
}
let cancelCurrent: (() => void) | undefined

export function imageCorners(
  image: HTMLImageElement
): ArtworkSource["corners"] {
  const rect = image.getBoundingClientRect()
  let { left, top, width, height } = rect
  // Use the actual printed area when thumbnails are letterboxed.
  const fit = getComputedStyle(image).objectFit
  if ((fit === "contain" || fit === "cover") && image.naturalWidth) {
    const scale = (fit === "cover" ? Math.max : Math.min)(
      width / image.naturalWidth,
      height / image.naturalHeight
    )
    const w = image.naturalWidth * scale,
      h = image.naturalHeight * scale
    left += (width - w) / 2
    top += (height - h) / 2
    width = w
    height = h
  }
  return [
    { x: left, y: top },
    { x: left + width, y: top },
    { x: left + width, y: top + height },
    { x: left, y: top + height },
  ]
}

export function imageClip(image: HTMLImageElement) {
  const thumb = image.closest<HTMLElement>(".artwork-list-thumb")
  if (thumb) {
    const [topLeft, topRight, bottomRight] = imageCorners(image),
      visible = thumb.getBoundingClientRect()
    const width = topRight.x - topLeft.x,
      height = bottomRight.y - topLeft.y
    if (width > 0 && height > 0) {
      const top = Math.max(0, ((visible.top - topLeft.y) / height) * 100),
        right = Math.max(0, ((topRight.x - visible.right) / width) * 100)
      const bottom = Math.max(
          0,
          ((bottomRight.y - visible.bottom) / height) * 100
        ),
        left = Math.max(0, ((visible.left - topLeft.x) / width) * 100)
      return `inset(${top}% ${right}% ${bottom}% ${left}%)`
    }
  }

  if (getComputedStyle(image).objectFit !== "cover" || !image.naturalWidth)
    return "inset(0% 0% 0% 0%)"
  const r = image.getBoundingClientRect(),
    s = Math.max(r.width / image.naturalWidth, r.height / image.naturalHeight)
  const x = Math.max(0, (1 - r.width / (image.naturalWidth * s)) * 50),
    y = Math.max(0, (1 - r.height / (image.naturalHeight * s)) * 50)
  return `inset(${y}% ${x}% ${y}% ${x}%)`
}
const sources = new Map<string, () => ArtworkSource | null>()
export function registerArtworkSource(
  href: string,
  read: () => ArtworkSource | null
) {
  sources.set(href, read)
  return () => {
    if (sources.get(href) === read) sources.delete(href)
  }
}
export function findArtworkSource(href: string) {
  return sources.get(href)?.() || null
}

// Map the unit image to a projected quadrilateral. This preserves the 3D
// painting's perspective when it leaves a WebGL scene, rather than using its AABB.
export function imageTransform(points: ArtworkSource["corners"]) {
  const [p0, p1, p2, p3] = points
  const dx1 = p1.x - p2.x,
    dx2 = p3.x - p2.x,
    dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y,
    dy2 = p3.y - p2.y,
    dy3 = p0.y - p1.y + p2.y - p3.y
  const determinant = dx1 * dy2 - dx2 * dy1
  const g =
    Math.abs(determinant) > 1e-8 ? (dx3 * dy2 - dx2 * dy3) / determinant : 0
  const h =
    Math.abs(determinant) > 1e-8 ? (dx1 * dy3 - dx3 * dy1) / determinant : 0
  const a = p1.x - p0.x + g * p1.x,
    b = p3.x - p0.x + h * p3.x
  const d = p1.y - p0.y + g * p1.y,
    e = p3.y - p0.y + h * p3.y
  // A 1000px sheet keeps the bitmap sharp while the matrix handles its size.
  return `matrix3d(${a / 1000},${d / 1000},0,${g / 1000},${b / 1000},${e / 1000},0,${h / 1000},0,0,1,0,${p0.x},${p0.y},0,1)`
}

export type ArtworkLanding = {
  href: string
  route: string
  src: string
  alt: string
  ratio: number
  key: string
  view: string
  scroll?: number
}
let landing: ArtworkLanding | null = null
const concealed = new Set<string>()
const origins = new Map<
  string,
  { route: string; view: string; scroll: number }
>()
export function getArtworkLanding() {
  return landing
}
export function isArtworkConcealed(href: string) {
  return concealed.has(href)
}
export function cancelArtworkTransition() {
  cancelCurrent?.()
}

function domArtwork(image: HTMLImageElement, href: string): ArtworkSource {
  return {
    href,
    src: image.currentSrc || image.src,
    alt: image.alt,
    corners: imageCorners(image),
    clip: imageClip(image),
    ratio: image.naturalWidth / image.naturalHeight,
    key: image.dataset.artworkKey,
    conceal: () => {
      const opacity = image.style.opacity
      image.style.opacity = "0"
      return () => {
        image.style.opacity = opacity
      }
    },
  }
}
function productTarget(href: string) {
  const image = Array.from(
    document.querySelectorAll<HTMLImageElement>("[data-artwork-main]")
  ).find((img) => img.dataset.artworkHref === href)
  if (!image?.complete || !image.naturalWidth) return null
  return domArtwork(image, href)
}
function returnTarget(href: string): ArtworkSource | null {
  const rowLinks = Array.from(
    document.querySelectorAll<HTMLAnchorElement>(".artwork-list-row")
  )
  const collectionHref = "/shop/prints/" + href.split("/")[3]
  const link =
    rowLinks.find((a) => new URL(a.href).pathname === href) ||
    rowLinks.find((a) => new URL(a.href).pathname === collectionHref)
  const image = link?.querySelector<HTMLImageElement>("img")
  if (image?.complete && image.naturalWidth) {
    const root = image.closest<HTMLElement>(".artwork-list"),
      thumb = image.closest<HTMLElement>(".artwork-list-thumb")
    if (root?.dataset.listEngine === "pending") return null
    if (
      root?.dataset.listEngine === "webgl" &&
      !root.hasAttribute("data-list-fallback") &&
      !thumb?.hasAttribute("data-gl-ready")
    )
      return null
    return domArtwork(image, new URL(link!.href).pathname)
  }
  return findArtworkSource(href)
}
function flyArtwork(
  source: ArtworkSource,
  route: string,
  navigate: (href: string) => void,
  resolve: () => ArtworkSource | null,
  request: ArtworkLanding | null
) {
  const layer = document.createElement("div")
  layer.className = "shared-artwork-layer"
  layer.setAttribute("aria-hidden", "true")
  const sheet = document.createElement("img")
  sheet.className = "shared-artwork-sheet"
  sheet.src = source.src
  sheet.alt = ""
  sheet.setAttribute("aria-hidden", "true")
  const from = imageTransform(source.corners),
    clip = source.clip || "inset(0% 0% 0% 0%)"
  sheet.style.transform = from
  sheet.style.clipPath = clip
  layer.appendChild(sheet)
  document.body.appendChild(layer)
  document.documentElement.dataset.artworkTransition = "waiting"
  let stopped = false,
    flying = false,
    restoreSource: (() => void) | undefined,
    restoreTarget: (() => void) | undefined,
    animation: Animation | undefined,
    raf = 0
  const cleanup = () => {
    if (stopped) return
    stopped = true
    observer.disconnect()
    cancelAnimationFrame(raf)
    clearTimeout(timeout)
    animation?.cancel()
    layer.remove()
    restoreSource?.()
    restoreTarget?.()
    concealed.clear()
    if (landing === request) landing = null
    delete document.documentElement.dataset.artworkTransition
    if (cancelCurrent === cleanup) cancelCurrent = undefined
  }
  const arrive = () => {
    if (
      stopped ||
      flying ||
      location.pathname !== new URL(route, location.origin).pathname
    )
      return
    const target = resolve()
    if (!target) return
    flying = true
    observer.disconnect()
    concealed.add(target.href)
    restoreTarget = target.conceal?.()
    document.documentElement.dataset.artworkTransition = "flying"
    raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (stopped) return
        // Re-read the destination after layout/scroll restoration. A list has its
        // own scroll container; a room or rail supplies projected WebGL corners.
        const measured = resolve() || target
        animation = sheet.animate(
          [
            { transform: from, clipPath: clip },
            {
              transform: imageTransform(measured.corners),
              clipPath: measured.clip || "inset(0% 0% 0% 0%)",
            },
          ],
          {
            duration: 820,
            easing: "cubic-bezier(.22,1,.36,1)",
            fill: "forwards",
          }
        )
        animation.finished
          .then(async () => {
            if (stopped) return
            if (
              new URL(target.src, location.origin).href !==
              new URL(source.src, location.origin).href
            ) {
              restoreTarget?.()
              restoreTarget = undefined
              concealed.delete(target.href)
              animation = sheet.animate([{ opacity: 1 }, { opacity: 0 }], {
                duration: 160,
                fill: "forwards",
              })
              await animation.finished
            }
            cleanup()
            document.dispatchEvent(
              new CustomEvent("artwork-transition-complete")
            )
          })
          .catch(cleanup)
      })
    )
  }
  const observer = new MutationObserver(arrive)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "data-artwork-href", "data-gl-ready"],
  })
  const timeout = setTimeout(cleanup, 6500)
  cancelCurrent = cleanup
  Promise.race([
    sheet.decode().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 150)),
  ]).then(() => {
    if (stopped) return
    concealed.add(source.href)
    restoreSource = source.conceal?.()
    navigate(route)
    const poll = () => {
      if (stopped || flying) return
      arrive()
      if (!flying) raf = requestAnimationFrame(poll)
    }
    poll()
  })
}
export function openArtwork(
  source: ArtworkSource,
  navigate: (href: string) => void
) {
  cancelCurrent?.()
  const root = document.querySelector<HTMLElement>(".artwork-list")
  origins.set(source.href, {
    route: location.pathname,
    view: localStorage.getItem("art-view") || "gallery",
    scroll: root?.scrollTop || scrollY,
  })
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    navigate(source.href)
    return
  }
  flyArtwork(
    source,
    source.href,
    navigate,
    () => productTarget(source.href),
    null
  )
}
export function returnArtwork(
  source: ArtworkSource,
  route: string,
  navigate: (href: string) => void
) {
  cancelCurrent?.()
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    navigate(route)
    return
  }
  const path = new URL(route, location.origin).pathname,
    view = localStorage.getItem("art-view") || "gallery",
    origin = origins.get(source.href)
  landing = {
    href: source.href,
    route: path,
    src: source.src,
    alt: source.alt,
    ratio: source.ratio || 1,
    key: source.key || source.src.match(/product-\d+/)?.[0] || source.href,
    view,
    scroll:
      origin?.route === path && origin.view === view
        ? origin.scroll
        : undefined,
  }
  flyArtwork(source, route, navigate, () => returnTarget(source.href), landing)
}
