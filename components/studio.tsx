"use client"
import Link from "next/link"
import dynamic from "next/dynamic"
import ArtworkList from "./artwork-list"
import { canUseWebGL, WEBGL_UNAVAILABLE } from "@/lib/webgl"
import RoomHandoff, { isHandheldARDevice } from "./room-handoff"
const Rotunda = dynamic(() => import("./rotunda"), { ssr: false })
const PrintLine = dynamic(() => import("./print-line"), { ssr: false })
const WallPreview = dynamic(() => import("./wall-preview"), { ssr: false })
const ArtistHead = dynamic(() => import("./artist-head"), { ssr: false })
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Search,
  Heart,
  ShoppingBag,
  UserRound,
  Sun,
  Moon,
  X,
  Plus,
  Minus,
  Grid2X2,
  List,
  ChevronDown,
  SlidersHorizontal,
  Menu,
  Bookmark,
} from "lucide-react"
import collections from "@/lib/collections.json"
import catalog from "@/lib/catalog.json"
import projects from "@/lib/projects.json"
import { BASE_PRINT_PRICE_INR, formatINR } from "@/lib/pricing"
import { wallPreviewHref, printSize, printFrame } from "@/lib/ar-options"
type Art = (typeof collections)[number]["prints"][number]
const all = catalog
  .filter((p, i, items) => items.findIndex((x) => x.key === p.key) === i)
  .map((p) => {
    const slug = p.href.split("/")[3]
    return {
      ...p,
      slug,
      collection:
        collections.find((c) => c.slug === slug)?.title || p.collection,
    }
  })
const price = BASE_PRINT_PRICE_INR
export default function Studio() {
  const path = usePathname()
  const home = path === "/"
  const shop = path.startsWith("/shop")
  const [newsletter, setNewsletter] = useState(false)
  const [paper, setPaper] = useState("Budget Art Paper")
  const [signature, setSignature] = useState("Unsigned")
  const [frame, setFrame] = useState("Unframed")
  const [quantity, setQuantity] = useState(1)
  const [readMore, setReadMore] = useState(false)
  const [menu, setMenu] = useState(false)
  const [view, setView] = useState("gallery")
  const [active, setActive] = useState(0)
  const [saved, setSaved] = useState<string[]>([])
  const [bag, setBag] = useState<
    {
      key: string
      size: string
      quantity: number
      paper?: string
      signature?: string
      frame?: string
    }[]
  >([])
  const [panel, setPanel] = useState("")
  const [search, setSearch] = useState("")
  const [dark, setDark] = useState(false)
  const [size, setSize] = useState("A3")
  const [filter, setFilter] = useState("all")
  const [notice, setNotice] = useState("")
  const [email, setEmail] = useState("")
  const [subscribed, setSubscribed] = useState(false)
  const drag = useRef(0)
  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem("art-saved") || "[]"))
      setBag(JSON.parse(localStorage.getItem("art-bag") || "[]"))
      setView(localStorage.getItem("art-view") || "gallery")
      setDark(localStorage.getItem("art-theme") === "dark")
    } catch {}
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!sessionStorage.getItem("newsletter-dismissed")) setNewsletter(true)
    }, 10000)
    return () => clearTimeout(timer)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light"
    localStorage.setItem("art-theme", dark ? "dark" : "light")
  }, [dark])
  useEffect(() => {
    setPanel("")
    setSearch("")
    setMenu(false)
    const options = new URLSearchParams(window.location.search)
    if (options.has("size")) setSize(printSize(options.get("size")))
    if (options.has("frame")) setFrame(printFrame(options.get("frame")))
  }, [path])
  useEffect(() => {
    if (!panel) return
    const prior = document.activeElement as HTMLElement | null
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const nodes = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),input,select,[tabindex="0"]'
        ) || []
      )
    const timer = setTimeout(() => {
      const first = dialog?.querySelector<HTMLElement>("input") || nodes()[0]
      first?.focus()
    }, 50)
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const list = nodes()
      const first = list[0],
        last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener("keydown", trap)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("keydown", trap)
      prior?.focus()
    }
  }, [panel])
  useEffect(() => {
    document.documentElement.dataset.scene =
      (home ||
        path === "/shop" ||
        path === "/shop/prints" ||
        !!collections.find(
          (c) =>
            path === `/shop/prints/${c.slug}` ||
            path === `/collection/${c.slug}`
        )) &&
      view === "gallery"
        ? "room"
        : ""
    return () => {
      delete document.documentElement.dataset.scene
    }
  }, [home, view, path])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setPanel("search")
      }
      if (e.key === "Escape") setPanel("")
      if (
        home &&
        !["INPUT", "SELECT"].includes((e.target as HTMLElement).tagName)
      ) {
      }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [home])
  useEffect(() => {
    const unavailable = () => setView("list")
    window.addEventListener(WEBGL_UNAVAILABLE, unavailable)
    if (!canUseWebGL()) unavailable()
    return () => window.removeEventListener(WEBGL_UNAVAILABLE, unavailable)
  }, [])
  const changeView = (v: string) => {
    if (v === "gallery" && !canUseWebGL()) {
      setView("list")
      setNotice(
        "3D is unavailable in this browser. Explore the artwork in List view."
      )
      return
    }
    setView(v)
    localStorage.setItem("art-view", v)
  }
  const toggleSave = (key: string) => {
    const v = saved.includes(key)
      ? saved.filter((k) => k !== key)
      : [...saved, key]
    setSaved(v)
    localStorage.setItem("art-saved", JSON.stringify(v))
  }
  const updateBag = (v: typeof bag) => {
    setBag(v)
    localStorage.setItem("art-bag", JSON.stringify(v))
  }
  const add = (p: Art) => {
    const exists = bag.find(
      (i) =>
        i.key === p.key &&
        i.size === size &&
        i.paper === paper &&
        i.frame === frame &&
        i.signature === signature
    )
    updateBag(
      exists
        ? bag.map((i) =>
            i === exists ? { ...i, quantity: i.quantity + quantity } : i
          )
        : [...bag, { key: p.key, size, quantity, paper, signature, frame }]
    )
    setPanel("bag")
  }
  const money = formatINR
  const project = projects.find((p) => p.href === path)
  const c = collections[active]
  const product = all.find((p) => p.href === path)
  const arProduct = all.find((p) => `${p.href}/ar` === path)
  const collection = collections.find(
    (c) => path === `/collection/${c.slug}` || path === `/shop/prints/${c.slug}`
  )
  const isProducts = path === "/shop/prints" || !!collection
  const shown = catalog
    .filter(
      (p) =>
        (filter === "all" || p.slug === filter) &&
        (!collection || p.slug === collection.slug)
    )
    .filter((p, i, items) => items.findIndex((x) => x.key === p.key) === i)
  return (
    <div
      className={`site ${(home || path === "/shop" || path === "/shop/prints" || !!collections.find((c) => path === `/shop/prints/${c.slug}` || path === `/collection/${c.slug}`)) && view === "gallery" ? "immersive-site" : ""}`}
    >
      <header className="header">
        <Link href="/" className="brand" aria-label="Shutabug home">
          <img src="/brand-mark.svg" alt="" />
          <span className="brand-name">SHUTABUG</span>
        </Link>
        <nav>
          <Link className={home ? "current" : ""} href="/">
            Index
          </Link>
          <Link className={shop ? "current" : ""} href="/shop">
            Shop
          </Link>
          <Link className={path === "/info" ? "current" : ""} href="/info">
            Info
          </Link>
          <Link
            className={path === "/auctions" ? "current" : ""}
            href="/auctions"
          >
            Auctions
          </Link>
          <button onClick={() => setPanel("help")}>
            Help <ArrowUpRight size={12} />
          </button>
        </nav>
        <div className="header-tools">
          <button
            className="mobile-menu-toggle"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu size={20} />
          </button>
          <button className="search-trigger" onClick={() => setPanel("search")}>
            <Search size={15} />
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
          <span
            className="currency inr-currency"
            aria-label="Currency: Indian rupee"
          >
            INR
          </span>
          <button
            aria-label="Toggle colour theme"
            onClick={() => setDark(!dark)}
          >
            {dark ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <Link href="/wishlist" aria-label="Saved artwork">
            <Bookmark size={18} strokeWidth={1.3} />
            {saved.length > 0 && <sup>{saved.length}</sup>}
          </Link>
          <Link href="/sign-in" aria-label="Account">
            <UserRound size={18} strokeWidth={1.3} />
          </Link>
          <button
            className="bag-trigger"
            onClick={() => setPanel("bag")}
            aria-label="Open bag"
          >
            <ShoppingBag size={17} />
            <span>({bag.reduce((n, i) => n + i.quantity, 0)})</span>
          </button>
        </div>
      </header>
      {menu && (
        <div className="mobile-navigation">
          <button
            className="menu-close"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
          {[
            ["/", "Index"],
            ["/shop", "Shop"],
            ["/info", "Info"],
            ["/auctions", "Auctions"],
            ["/wishlist", "Saved"],
          ].map(([url, label]) => (
            <Link key={url} href={url} onClick={() => setMenu(false)}>
              {label}
            </Link>
          ))}
          <button
            style={{ textAlign: "left", fontSize: "inherit" }}
            onClick={() => {
              setMenu(false)
              setPanel("help")
            }}
          >
            Help
          </button>
        </div>
      )}
      <main id="main">
        {arProduct && <WallPreview product={arProduct} />}
        {home && (
          <>
            <div className="scene-switches">
              <span>View</span>
              <button
                className={view === "gallery" ? "chosen" : ""}
                onClick={() => changeView("gallery")}
              >
                Gallery
              </button>
              <button
                className={view === "list" ? "chosen" : ""}
                onClick={() => changeView("list")}
              >
                List
              </button>
            </div>
            {view === "gallery" ? (
              <Rotunda dark={dark} />
            ) : (
              <ArtworkList
                key={path}
                sections={collections.map((c) => ({
                  key: c.slug,
                  title: c.title,
                  note: `${c.count} prints`,
                  href: `/shop/prints/${c.slug}`,
                  link: `All ${c.count}`,
                  items: c.prints.map((p) => ({ ...p, meta: c.title })),
                }))}
              />
            )}
          </>
        )}
        {(path === "/shop" || path === "/shop/prints") && (
          <>
            <div className="scene-switches">
              <span>View</span>
              <button
                className={view === "gallery" ? "chosen" : ""}
                onClick={() => changeView("gallery")}
              >
                Gallery
              </button>
              <button
                className={view === "list" ? "chosen" : ""}
                onClick={() => changeView("list")}
              >
                List
              </button>
            </div>
            {view === "gallery" ? (
              <PrintLine dark={dark} />
            ) : (
              <ArtworkList
                key={path}
                title="Prints"
                sections={[
                  {
                    key: "collections",
                    items: collections.map((c) => ({
                      key: c.slug,
                      href: `/shop/prints/${c.slug}`,
                      title: c.title,
                      src: c.prints[0].src,
                      ratio: c.prints[0].ratio,
                      meta: `${c.count} prints — tap to open`,
                    })),
                  },
                ]}
              />
            )}
          </>
        )}
        {collection && view === "gallery" && (
          <>
            <div className="scene-switches">
              <span>View</span>
              <button className="chosen" onClick={() => changeView("gallery")}>
                Gallery
              </button>
              <button onClick={() => changeView("list")}>List</button>
            </div>
            <PrintLine
              key={collection.slug}
              dark={dark}
              collectionSlug={collection.slug}
            />
          </>
        )}
        {collection && view === "list" && (
          <>
            <div className="scene-switches">
              <span>View</span>
              <button
                aria-pressed={false}
                onClick={() => changeView("gallery")}
              >
                Gallery
              </button>
              <button
                aria-pressed={true}
                className="chosen"
                onClick={() => changeView("list")}
              >
                List
              </button>
            </div>
            <ArtworkList
              key={path}
              title={collection.title}
              description={collection.description}
              back={{ href: "/shop", label: "All collections" }}
              sections={[
                {
                  key: collection.slug,
                  items: shown.map((p) => ({ ...p, price: money(price) })),
                },
              ]}
            />
          </>
        )}

        {product && (
          <section className="inner product-detail">
            <div className="detail-grid">
              <div className="detail-visual">
                <button
                  className="detail-art"
                  onClick={() => setPanel("zoom")}
                  aria-label="Enlarge artwork"
                >
                  <img
                    src={product.src}
                    alt={product.title}
                    data-artwork-key={product.key}
                    data-artwork-main
                    data-artwork-href={product.href}
                  />
                </button>
                <div className="detail-image-tools">
                  <span>1/1</span>
                  <Link
                    href={wallPreviewHref(product.href, size, frame)}
                    onClick={(event) => {
                      if (
                        event.button !== 0 ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      )
                        return
                      if (!isHandheldARDevice()) {
                        event.preventDefault()
                        setPanel("room")
                      }
                    }}
                  >
                    View In Room <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
              <div className="detail-copy">
                <Link className="back" href={`/shop/prints/${product.slug}`}>
                  ← Back to Prints
                </Link>
                <Link
                  className="detail-collection"
                  href={`/shop/prints/${product.slug}`}
                >
                  {product.collection}
                </Link>
                <h1>{product.title}</h1>
                <div className={`product-story ${readMore ? "expanded" : ""}`}>
                  <p>
                    {
                      collections.find((c) => c.slug === product.slug)
                        ?.description
                    }
                  </p>
                </div>
                <button
                  className="read-more"
                  onClick={() => setReadMore(!readMore)}
                >
                  {readMore ? "Read less −" : "Read more +"}
                </button>
                <p className="detail-price">
                  {money(
                    price +
                      (size === "A2"
                        ? 3500
                        : size === "A1"
                          ? 7500
                          : size === "A0"
                            ? 15000
                            : 0)
                  )}
                </p>
                <p className="edition-note">Limited Edition of 25</p>
                <p className="tax-note">
                  Shop prices exclude tax. Applicable tax is calculated from
                  your delivery address and added at checkout.
                </p>
                <div className="variant-group">
                  <label>
                    Paper: <span>{paper}</span>
                  </label>
                  <div>
                    {[
                      "Budget Art Paper",
                      "Giclée Fine Art Paper",
                      "Hahnemühle German Etching",
                    ].map((v) => (
                      <button
                        key={v}
                        className={paper === v ? "on" : ""}
                        onClick={() => setPaper(v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="variant-group">
                  <label>
                    Size: <span>{size}</span>
                  </label>
                  <div>
                    {["A3", "A2", "A1", "A0"].map((v, i) => (
                      <button
                        key={v}
                        className={size === v ? "on" : ""}
                        onClick={() => setSize(v)}
                      >
                        {
                          [
                            "11.7 × 16.5",
                            "16.5 × 23.4",
                            "23.4 × 33.1",
                            "33.1 × 46.8",
                          ][i]
                        }
                        ” ({v})
                      </button>
                    ))}
                  </div>
                </div>
                <div className="variant-group">
                  <label>
                    Signature: <span>{signature}</span>
                  </label>
                  <div>
                    {["Unsigned", "Signed and Numbered"].map((v) => (
                      <button
                        key={v}
                        className={signature === v ? "on" : ""}
                        onClick={() => {
                          setSignature(v)
                          if (v !== "Unsigned")
                            setPaper("Giclée Fine Art Paper")
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="variant-group">
                  <label>
                    Frame: <span>{frame}</span>
                  </label>
                  <div>
                    {["Unframed", "Classic frame", "Framed canvas"].map((v) => (
                      <button
                        key={v}
                        className={frame === v ? "on" : ""}
                        onClick={() => {
                          setFrame(v)
                          if (v !== "Unframed")
                            setPaper("Giclée Fine Art Paper")
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="add-row">
                  <div className="quantity">
                    <button
                      aria-label="One fewer"
                      disabled={quantity <= 1}
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      −
                    </button>
                    <output>{quantity}</output>
                    <button
                      aria-label="One more"
                      disabled={quantity >= 9}
                      onClick={() => setQuantity(Math.min(9, quantity + 1))}
                    >
                      +
                    </button>
                  </div>
                  <button className="solid-button" onClick={() => add(product)}>
                    add to bag
                  </button>
                  <button
                    className="detail-save"
                    onClick={() => toggleSave(product.key)}
                    aria-label="Save artwork"
                  >
                    <Heart
                      size={18}
                      fill={
                        saved.includes(product.key) ? "currentColor" : "none"
                      }
                    />
                  </button>
                </div>
                {["Paper & Sizes", "Delivery Info", "Returns Policy"].map(
                  (t, i) => (
                    <details key={t}>
                      <summary>
                        {t}
                        <Plus size={14} />
                      </summary>
                      <p>
                        {
                          [
                            "Choose from Budget Art Paper, Giclée Fine Art Paper, or Hahnemühle German Etching in sizes A3 through A0. Each paper offers a different texture and finish.",
                            "Delivery options and quotes will be provided when the store backend is connected.",
                            "For order questions or damage inquiries, please contact support@shutabug.com. Store return handling will be connected with the backend.",
                          ][i]
                        }
                      </p>
                    </details>
                  )
                )}
              </div>
            </div>
            <section className="related-prints">
              <h2>you may also like</h2>
              <div className="products-grid">
                {all
                  .filter(
                    (p) => p.slug === product.slug && p.key !== product.key
                  )
                  .slice(0, 4)
                  .map((p) => (
                    <Link key={p.key} href={p.href}>
                      <div className="product-image">
                        <img src={p.src} alt={p.title} />
                      </div>
                      <p>{p.title}</p>
                      <small>Prints</small>
                    </Link>
                  ))}
              </div>
            </section>
          </section>
        )}
        {path === "/info" && (
          <section className="reference-about">
            <div className="about-hero">
              <ArtistHead />
              <h1 className="artist-name">
                <span>“Shutabug”</span>
                <span>Mayowa</span>
                <span>Alabi</span>
              </h1>
              <div className="artist-biography">
                <p>
                  Mayowa 'Shutabug' Alabi, is a multidisciplinary Visual Artist,
                  Graphic Designer, Photographer and Animator based in Lagos,
                  Nigeria.
                </p>
                <p>
                  Specializing in digital paintings, his work exudes a
                  deliberate rawness, preserving an authentic sense of
                  originality. His journey began in 2017, winning the European
                  Union/United Nations Women Gender Equality Picture It Comic
                  &amp; Cartoon Competition. This ignited his artistic path.
                </p>
                <p>
                  Mayowa has hosted two solo exhibitions in Lagos and Nairobi,
                  while also being a part of various design and art projects for
                  many exceptional brands like Meta, Uber, and Desperados. He
                  also contributed as an illustrator for Kim Chakanetsa’s book,
                  “Africana: An Encyclopedia of an Amazing Continent.”
                </p>
              </div>
            </div>
            <section className="about-interviews">
              <span className="eyebrow">Selected Interviews</span>
              <a
                href="https://www.lequipe.fr/"
                target="_blank"
                rel="noreferrer"
              >
                L'equipe <ArrowUpRight size={17} />
              </a>
              <a
                href="https://www.behance.net/shutabug"
                target="_blank"
                rel="noreferrer"
              >
                From Lagos to the world… Shutabug paints human stories in the
                language of art <ArrowUpRight size={17} />
              </a>
            </section>
            <section className="commissioned">
              <span className="eyebrow">Commissioned By</span>
              <div className="client-reel">
                <span>Meta</span>
                <span>Uber</span>
                <span>DESPERADOS</span>
                <span>AFRICANA</span>
              </div>
              <div className="press-contact">
                <span>For Press &amp; Collaborations</span>
                <a href="mailto:bba@shutabug.com">bba@shutabug.com ↗</a>
              </div>
            </section>
            <section className="selected-projects">
              <h2>Selected Projects</h2>
              <div className="projects-track">
                {projects.map((p) => (
                  <Link key={p.href} href={p.href}>
                    {p.kind === "video" ? (
                      <video src={p.src} autoPlay muted loop playsInline />
                    ) : (
                      <img src={p.src} alt={p.title} />
                    )}
                    <h3>{p.title} ↗</h3>
                  </Link>
                ))}
              </div>
              <a
                href="https://www.behance.net/shutabug"
                target="_blank"
                rel="noreferrer"
              >
                See more ↗
              </a>
            </section>
          </section>
        )}
        {project && (
          <section className="inner project-page">
            <Link className="back" href="/info">
              ← Selected Projects
            </Link>
            <h1>{project.title}</h1>
            {project.kind === "video" ? (
              <video src={project.src} controls playsInline />
            ) : (
              <img
                className="project-cover"
                src={project.src}
                alt={project.title}
              />
            )}
            <div className="project-gallery">
              {project.rows.map((row, i) =>
                row.type === "text" ? (
                  <p key={i}>{row.text}</p>
                ) : (
                  <figure key={i}>
                    <img src={row.src} alt={row.alt} loading="lazy" />
                    {row.text && <figcaption>{row.text}</figcaption>}
                  </figure>
                )
              )}
            </div>
            <a
              className="text-link"
              href={project.link}
              target="_blank"
              rel="noreferrer"
            >
              See the project ↗
            </a>
          </section>
        )}
        {path === "/wishlist" && (
          <section className="inner">
            <div className="page-heading">
              <span className="eyebrow">YOUR PERSONAL COLLECTION</span>
              <h1>Good taste. Saved.</h1>
              <p>
                {saved.length
                  ? "The pieces that caught your eye."
                  : "Save the art you love, and find it here."}
              </p>
            </div>
            <div className="products-grid">
              {all
                .filter((p) => saved.includes(p.key))
                .map((p) => (
                  <article className="product-card" key={p.key}>
                    <Link href={p.href}>
                      <div className="product-image">
                        <img src={p.src} alt={p.title} />
                      </div>
                      <h2>{p.title}</h2>
                    </Link>
                    <button
                      className="save"
                      onClick={() => toggleSave(p.key)}
                      aria-label="Remove saved artwork"
                    >
                      <X size={17} />
                    </button>
                  </article>
                ))}
            </div>
            {!saved.length && (
              <Link href="/shop" className="solid-button inline">
                Explore the shop <ArrowUpRight size={16} />
              </Link>
            )}
          </section>
        )}
        {path === "/auctions" && (
          <section className="inner auction reference-auction">
            <h1>Auctions</h1>
            <div className="empty-pegs">
              <div className="empty-wire" />
              <i />
              <i />
              <i />
            </div>
            <div className="auction-message">
              <span className="eyebrow">Empty pegs</span>
              <h2>Nothing is up just now</h2>
              <p>
                One-offs, proofs and originals from the studio go up here now
                and then. The next lot will be announced before it opens, so
                keep an eye on this page.
              </p>
              <Link href="/shop">Have a look round the shop →</Link>
            </div>
          </section>
        )}
        {(path === "/sign-in" || path === "/account") && (
          <section className="auth inner">
            <span className="eyebrow">YOUR LITTLE CORNER</span>
            <h1>Sign in</h1>
            <p>
              For your saved work, your orders, and anything waiting in the
              studio.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setNotice(
                  "Account sign-in will be available when the backend is connected. Your saved artwork and bag are stored on this device."
                )
              }}
            >
              <label>
                Email
                <input type="email" required autoComplete="email" />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                />
              </label>
              <Link className="forgot-link" href="/forgot-password">
                Forgotten your password?
              </Link>
              <button className="solid-button">Sign in</button>
            </form>
            <p>
              New here?{" "}
              <Link href="/create-account" className="underlined">
                Create an account
              </Link>
              .
            </p>
            {notice && <p role="status">{notice}</p>}
          </section>
        )}
        {["/create-account", "/forgot-password"].includes(path) && (
          <section className="auth inner">
            <h1>
              {path === "/create-account"
                ? "Create an account"
                : "Reset your password"}
            </h1>
            <p>
              {path === "/create-account"
                ? "A place for your saved work and orders."
                : "Enter your email and we’ll help you get back in."}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setNotice(
                  "This frontend is ready. Account services will work once your backend is connected."
                )
              }}
            >
              {path === "/create-account" && (
                <label>
                  Name
                  <input required autoComplete="name" />
                </label>
              )}
              <label>
                Email
                <input type="email" required autoComplete="email" />
              </label>
              {path === "/create-account" && (
                <label>
                  Password
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </label>
              )}
              <button className="solid-button">
                {path === "/create-account"
                  ? "Create account"
                  : "Send reset link"}
              </button>
            </form>
            {notice && <p role="status">{notice}</p>}
            <Link className="underlined" href="/sign-in">
              Back to sign in
            </Link>
          </section>
        )}
        {["/privacy", "/terms", "/shipping"].includes(path) && (
          <section className="inner policy">
            <span className="eyebrow">THE SMALL PRINT</span>
            <h1>
              {path === "/privacy"
                ? "Privacy"
                : path === "/terms"
                  ? "Terms of use"
                  : "Shipping & returns"}
            </h1>
            <p>
              This is an independent frontend demonstration. Commerce and
              account services are not connected.
            </p>
            <h2>
              {path === "/privacy"
                ? "Your data"
                : path === "/terms"
                  ? "Using this website"
                  : "Orders & delivery"}
            </h2>
            <p>
              {path === "/privacy"
                ? "Your bag, theme preference and saved artwork stay in your browser’s local storage. Forms on this demo do not send data to a server."
                : path === "/terms"
                  ? "Artwork is presented as reference material for this recreation. Prices and product options are illustrative. No payment is collected."
                  : "Delivery regions, production times, return policies and shipping costs will be confirmed when the store backend is added."}
            </p>
            <a href="mailto:support@shutabug.com" className="text-link">
              Contact support <ArrowUpRight size={15} />
            </a>
          </section>
        )}
      </main>
      <footer>
        <div className="footer-intro">
          <Link href="/" className="footer-wordmark">
            SHUTABUG<span>↗</span>
          </Link>
          <p>Art, in good company.</p>
          <Link href="/shop/prints" className="footer-explore">
            Find your next favourite <ArrowUpRight size={16} />
          </Link>
        </div>
        <span>© Shutabug. {new Date().getFullYear()}</span>
        <div className="socials">
          <a
            aria-label="Instagram"
            href="https://instagram.com/shuta.bug"
            target="_blank"
            rel="noreferrer"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r=".8" />
            </svg>
          </a>
          <a
            aria-label="X"
            href="https://x.com/shutabug"
            target="_blank"
            rel="noreferrer"
          >
            𝕏
          </a>
        </div>
        <div>
          <span className="muted">Policies:</span>{" "}
          <Link href="/privacy">Privacy</Link>, <Link href="/terms">Terms</Link>{" "}
          <span className="muted">&</span>{" "}
          <Link href="/shipping">Shipping</Link>
        </div>
        <span className="footer-note">A WORLD IN COLOUR ↗</span>
      </footer>
      {panel === "room" && product && (
        <RoomHandoff
          href={wallPreviewHref(product.href, size, frame)}
          onClose={() => setPanel("")}
        />
      )}
      {panel && panel !== "room" && (
        <div
          className={`overlay ${panel === "zoom" ? "zoom-overlay" : ""}`}
          onClick={() => setPanel("")}
        >
          <section
            className={`panel ${panel === "search" ? "search-panel" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={panel}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-header">
              <span>
                {panel === "bag"
                  ? "Your bag"
                  : panel === "search"
                    ? "Find your next favourite"
                    : panel === "help"
                      ? "A little help?"
                      : "A closer look"}
              </span>
              <button onClick={() => setPanel("")} aria-label="Close dialog">
                <X size={21} />
              </button>
            </div>
            {panel === "search" && (
              <>
                <div className="search-input">
                  <Search size={21} />
                  <input
                    autoFocus
                    placeholder="Search art, collections, colours…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <kbd>ESC</kbd>
                </div>
                {search ? (
                  <div className="search-results">
                    {all
                      .filter((p) =>
                        (p.title + " " + p.collection)
                          .toLowerCase()
                          .includes(search.toLowerCase())
                      )
                      .slice(0, 20)
                      .map((p) => (
                        <Link href={p.href} key={p.key}>
                          <img src={p.src} alt="" />
                          <div>
                            {p.title}
                            <small>{p.collection}</small>
                          </div>
                          <ArrowUpRight size={18} />
                        </Link>
                      ))}
                    {!all.some((p) =>
                      (p.title + " " + p.collection)
                        .toLowerCase()
                        .includes(search.toLowerCase())
                    ) && <p>No matches. Try another title or collection.</p>}
                  </div>
                ) : (
                  <>
                    <p className="eyebrow">BROWSE COLLECTIONS</p>
                    <div className="search-chips">
                      {collections.map((c) => (
                        <Link href={`/collection/${c.slug}`} key={c.slug}>
                          {c.title} <ArrowUpRight size={12} />
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            {panel === "bag" && (
              <>
                {bag.length ? (
                  <>
                    <div className="bag-items">
                      {bag.map((i, n) => {
                        const p = all.find((p) => p.key === i.key)!
                        return (
                          <div className="bag-item" key={n}>
                            <img src={p.src} alt={p.title} />
                            <div>
                              <Link href={p.href}>{p.title}</Link>
                              <small>{i.size} · Fine art print</small>
                              <div className="quantity">
                                <button
                                  aria-label="Decrease quantity"
                                  onClick={() =>
                                    updateBag(
                                      i.quantity === 1
                                        ? bag.filter((_, j) => j !== n)
                                        : bag.map((x, j) =>
                                            j === n
                                              ? {
                                                  ...x,
                                                  quantity: x.quantity - 1,
                                                }
                                              : x
                                          )
                                    )
                                  }
                                >
                                  <Minus size={12} />
                                </button>
                                {i.quantity}
                                <button
                                  aria-label="Increase quantity"
                                  onClick={() =>
                                    updateBag(
                                      bag.map((x, j) =>
                                        j === n
                                          ? { ...x, quantity: x.quantity + 1 }
                                          : x
                                      )
                                    )
                                  }
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                            <span>
                              {money(
                                (price +
                                  (i.size === "A2"
                                    ? 3500
                                    : i.size === "A1"
                                      ? 7500
                                      : i.size === "A0"
                                        ? 15000
                                        : 0)) *
                                  i.quantity
                              )}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="bag-total">
                      <span>Subtotal</span>
                      <span>
                        {money(
                          bag.reduce(
                            (n, i) =>
                              n +
                              (price +
                                (i.size === "A2"
                                  ? 3500
                                  : i.size === "A1"
                                    ? 7500
                                    : i.size === "A0"
                                      ? 15000
                                      : 0)) *
                                i.quantity,
                            0
                          )
                        )}
                      </span>
                    </div>
                    <p className="muted">
                      Your bag is saved on this device. Payments and shipping
                      will be connected with the backend.
                    </p>
                    <Link
                      className="solid-button"
                      href="/shop"
                      onClick={() => setPanel("")}
                    >
                      Keep exploring <ArrowRight size={16} />
                    </Link>
                  </>
                ) : (
                  <div className="empty-bag">
                    <ShoppingBag size={45} strokeWidth={1} />
                    <h2>A little room for colour.</h2>
                    <p>Your bag is waiting for something good.</p>
                    <Link
                      href="/shop"
                      className="solid-button"
                      onClick={() => setPanel("")}
                    >
                      Explore the shop <ArrowUpRight size={16} />
                    </Link>
                  </div>
                )}
              </>
            )}
            {panel === "help" && (
              <div className="help-content">
                <p>
                  Questions about a print, an order, or a collaboration? Let's
                  talk.
                </p>
                {[
                  "Orders & delivery",
                  "Returns & damage",
                  "Prints & products",
                  "Artist inquiries",
                ].map((t) => (
                  <a
                    href={`mailto:support@shutabug.com?subject=${encodeURIComponent(t)}`}
                    key={t}
                  >
                    {t}
                    <ArrowUpRight size={18} />
                  </a>
                ))}
                <a href="mailto:support@shutabug.com">support@shutabug.com</a>
              </div>
            )}
            {panel === "zoom" && product && (
              <img
                className="zoom-image"
                src={product.src}
                alt={product.title}
              />
            )}
          </section>
        </div>
      )}
      {newsletter && !panel && !arProduct && (
        <aside className="newsletter-postcard" aria-label="Newsletter">
          <button
            className="postcard-close"
            aria-label="Dismiss newsletter"
            onClick={() => {
              setNewsletter(false)
              sessionStorage.setItem("newsletter-dismissed", "1")
            }}
          >
            <X size={14} />
          </button>
          <span>Newsletter</span>
          <h2>Postcards from Lagos</h2>
          <p>
            New drops, auctions and work in progress, a few times a year.
            Nothing else.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSubscribed(true)
            }}
          >
            <input
              type="email"
              required
              placeholder="you@example.com"
              aria-label="Newsletter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button aria-label="Join newsletter">
              <ArrowRight size={18} />
            </button>
          </form>
          <small role="status">
            {subscribed
              ? "Preview saved. Email delivery needs the backend."
              : "Unsubscribe whenever you like."}
          </small>
        </aside>
      )}
    </div>
  )
}
