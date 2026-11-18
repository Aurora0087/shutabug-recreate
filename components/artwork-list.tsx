"use client"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { getArtworkLanding } from "@/lib/artwork-transition"
const ListMotion = dynamic(() => import("./list-motion"), { ssr: false })
export type ListItem = {
  key: string
  href: string
  title: string
  src: string
  ratio: number
  meta?: string
  price?: string
}
export type ListSection = {
  key: string
  title?: string
  note?: string
  href?: string
  link?: string
  items: ListItem[]
}

export default function ArtworkList({
  title,
  description,
  back,
  sections,
}: {
  title?: string
  description?: string
  back?: { href: string; label: string }
  sections: ListSection[]
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [landing] = useState(() => getArtworkLanding())
  const displaySections = useMemo(() => {
    if (
      !landing ||
      sections.some((s) => s.items.some((item) => item.href === landing.href))
    )
      return sections
    const slug = landing.href.split("/")[3]
    if (
      sections.some((section) =>
        section.items.some((item) => item.href === `/shop/prints/${slug}`)
      )
    ) {
      return sections.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.href === `/shop/prints/${slug}`
            ? { ...item, src: landing.src, ratio: landing.ratio }
            : item
        ),
      }))
    }
    return sections.map((section) =>
      section.key === slug
        ? {
            ...section,
            items: [
              ...section.items,
              {
                key: landing.key,
                href: landing.href,
                title: landing.alt,
                src: landing.src,
                ratio: landing.ratio,
                meta: section.title,
              },
            ],
          }
        : section
    )
  }, [sections, landing])
  useLayoutEffect(() => {
    const root = scroller.current
    if (!root || !landing) return
    const links = Array.from(
      root.querySelectorAll<HTMLAnchorElement>(".artwork-list-row")
    )
    const link =
      links.find((a) => a.pathname === landing.href) ||
      links.find(
        (a) => a.pathname === "/shop/prints/" + landing.href.split("/")[3]
      )
    if (!link) return
    link.closest<HTMLElement>("li")!.dataset.returnTarget = ""
    if (landing.scroll !== undefined) root.scrollTop = landing.scroll
    const rect = link.getBoundingClientRect()
    if (
      landing.scroll === undefined ||
      rect.top < 80 ||
      rect.bottom > root.clientHeight
    ) {
      root.scrollTop +=
        rect.top - Math.max(125, (root.clientHeight - rect.height) / 2)
    }
  }, [landing])

  const [engine, setEngine] = useState<"pending" | "webgl" | "dom">("pending")
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const preference = matchMedia("(prefers-reduced-motion: reduce)")
    const change = () =>
      setEngine(
        !preference.matches && !!window.WebGLRenderingContext ? "webgl" : "dom"
      )
    change()
    preference.addEventListener("change", change)
    const previous = document.documentElement.dataset.listPage
    document.documentElement.dataset.listPage = ""
    const nodes = Array.from(
      element.querySelectorAll<HTMLElement>("[data-list-reveal]")
    )
    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          .forEach((entry, index) => {
            const node = entry.target as HTMLElement
            node.style.setProperty(
              "--reveal-delay",
              `${Math.min(index, 8) * 55}ms`
            )
            node.dataset.shown = ""
            observer.unobserve(node)
          })
      },
      { root: element, rootMargin: "0px 0px -6% 0px", threshold: 0.12 }
    )
    nodes.forEach((node) => {
      if (preference.matches) node.dataset.shown = ""
      else observer.observe(node)
    })
    return () => {
      observer.disconnect()
      preference.removeEventListener("change", change)
      if (previous === undefined)
        delete document.documentElement.dataset.listPage
      else document.documentElement.dataset.listPage = previous
    }
  }, [])
  return (
    <div
      className="artwork-list"
      data-list-engine={engine}
      ref={scroller}
      aria-label={title || "Artwork collections"}
    >
      <div className="artwork-list-inner">
        {(title || back) && (
          <div className="artwork-list-head">
            {back && <Link href={back.href}>← {back.label}</Link>}
            {title && <h1>{title}</h1>}
            {description && <p>{description}</p>}
          </div>
        )}
        {displaySections.map((section) => (
          <section
            className="artwork-list-section"
            key={section.key}
            aria-label={section.title || title}
          >
            {section.title && (
              <div className="artwork-list-section-head" data-list-reveal>
                <h2 data-list-gl="heading">{section.title}</h2>
                {section.note && <span>{section.note}</span>}
                {section.href && (
                  <Link href={section.href}>
                    {section.link || "View all"} →
                  </Link>
                )}
              </div>
            )}
            <ul className="artwork-list-rows">
              {section.items.map((item) => (
                <li data-list-reveal key={item.key}>
                  <Link className="artwork-list-row" href={item.href}>
                    <span
                      className="artwork-list-thumb"
                      data-list-gl="image"
                      data-src={item.src}
                      style={{ aspectRatio: String(item.ratio || 5 / 7) }}
                    >
                      <img
                        src={item.src}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                    <span className="artwork-list-text">
                      <span className="artwork-list-title" data-list-gl="title">
                        {item.title}
                      </span>
                      {item.meta && (
                        <span className="artwork-list-meta" data-list-gl="meta">
                          {item.meta}
                        </span>
                      )}
                    </span>
                    {item.price && (
                      <span className="artwork-list-price" data-list-gl="price">
                        {item.price}
                      </span>
                    )}
                    <span className="artwork-list-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {engine === "webgl" && (
        <ListMotion scroller={scroller} onFallback={() => setEngine("dom")} />
      )}
    </div>
  )
}
