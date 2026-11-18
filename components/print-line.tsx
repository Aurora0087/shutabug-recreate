"use client"
import SafeCanvas from "./safe-canvas"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import * as THREE from "three"
import collections from "@/lib/collections.json"
import catalog from "@/lib/catalog.json"
import {
  openArtwork,
  registerArtworkSource,
  findArtworkSource,
  getArtworkLanding,
  isArtworkConcealed,
} from "@/lib/artwork-transition"
import { projectedArtwork } from "@/lib/project-artwork"
import { BASE_PRINT_PRICE_INR, formatINR } from "@/lib/pricing"
type RailItem = {
  title: string
  src: string
  ratio: number
  href: string
  count: number
}
const mod = (n: number, total: number) => ((n % total) + total) % total
function Sheets({
  motion,
  onActive,
  onOpen,
  dark,
  sway,
  items,
}: {
  motion: MutableRefObject<{
    pos: number
    target: number
    velocity: number
    dragged: boolean
  }>
  onActive: (n: number) => void
  onOpen: (n: number, mesh?: THREE.Object3D) => void
  dark: boolean
  sway: boolean
  items: RailItem[]
}) {
  const { camera, gl } = useThree()
  const router = useRouter()
  useEffect(() => {
    const read = (item: RailItem, index: number) => () => {
      const group = groups.current.find(
        (g) => g && mod(g.userData.index, items.length) === index
      )
      const mesh = group?.children[1]
      if (
        !mesh ||
        !(
          (mesh as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>)
            .material.map?.image as { width?: number } | undefined
        )?.width
      )
        return null
      const corners = projectedArtwork(mesh, camera, gl.domElement)
      if (!corners) return null
      return {
        href: item.href,
        src: item.src,
        alt: item.title,
        corners,
        conceal: () => {
          mesh.visible = false
          return () => {
            mesh.visible = true
          }
        },
      }
    }
    const cleanup = items.map((item, index) =>
      registerArtworkSource(item.href, read(item, index))
    )
    const landing = getArtworkLanding()
    if (landing && !items.some((item) => item.href === landing.href)) {
      const index = items.findIndex(
        (item) => item.href === "/shop/prints/" + landing.href.split("/")[3]
      )
      if (index >= 0)
        cleanup.push(
          registerArtworkSource(landing.href, read(items[index], index))
        )
    }
    return () => cleanup.forEach((dispose) => dispose())
  }, [items, camera, gl])

  const groups = useRef<(THREE.Group | null)[]>([])
  const last = useRef(-1)
  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader()
    return items.map((c) => {
      const t = loader.load(c.src)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      return t
    })
  }, [items])
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures])
  const wire = useMemo(() => {
    const points = []
    for (let i = 0; i <= 80; i++) {
      const x = -30 + i * 0.75
      points.push(new THREE.Vector3(x, 1.65 + 0.006 * x * x, 0))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [])
  const wireObject = useMemo(
    () =>
      new THREE.Line(
        wire,
        new THREE.LineBasicMaterial({
          color: dark ? "#9d9d95" : "#85857d",
          transparent: true,
          opacity: 0.75,
        })
      ),
    [wire, dark]
  )
  useEffect(
    () => () => {
      wireObject.material.dispose()
    },
    [wireObject]
  )
  useEffect(() => () => wire.dispose(), [wire])
  useFrame((state, dt) => {
    const m = motion.current
    const before = m.pos
    m.pos += (m.target - m.pos) * (1 - Math.pow(0.9, Math.min(dt * 60, 4)))
    m.velocity = m.pos - before
    const selected = mod(Math.round(m.pos), items.length)
    if (last.current !== selected) {
      last.current = selected
      onActive(selected)
    }
    for (let i = 0; i < 7; i++) {
      const group = groups.current[i]
      if (!group) continue
      const n = Math.floor(m.pos) + i - 3,
        c = items[mod(n, items.length)],
        x = (n - m.pos) * 4.2
      group.position.set(x, 1.65 + 0.006 * x * x, 0)
      const ratio = c.ratio
      const height = Math.min(3.3, 3.3 / ratio)
      const art = group.children[1] as THREE.Mesh
      art.visible = !isArtworkConcealed(c.href)
      art.scale.set(height * ratio, height, 1)
      art.position.y = -height / 2 - 0.26
      const material = art.material as THREE.MeshBasicMaterial
      if (material.map !== textures[mod(n, items.length)]) {
        material.map = textures[mod(n, items.length)]
        material.needsUpdate = true
      }
      group.rotation.y = Math.max(-0.18, Math.min(0.18, x * 0.015))
      group.rotation.z = sway
        ? Math.sin(state.clock.elapsedTime * 1.5 + n) * 0.012 +
          m.velocity * 0.14
        : 0
      group.rotation.x = sway
        ? Math.max(-0.2, Math.min(0.2, m.velocity * 0.35))
        : 0
      group.userData.index = n
    }
  })
  const click = (e: ThreeEvent<MouseEvent>, slot: number) => {
    e.stopPropagation()
    if (motion.current.dragged) return
    const n = groups.current[slot]?.userData.index ?? 0
    if (Math.round(motion.current.target) === n) {
      const item = items[mod(n, items.length)]
      const corners = projectedArtwork(e.object, camera, gl.domElement)
      if (item.href.split("/").length === 5 && corners) {
        const object = e.object
        openArtwork(
          {
            href: item.href,
            src: item.src,
            alt: item.title,
            corners,
            conceal: () => {
              object.visible = false
              return () => {
                object.visible = true
              }
            },
          },
          (href) => router.push(href)
        )
      } else onOpen(mod(n, items.length), e.object)
    } else motion.current.target = n
  }
  return (
    <>
      <color attach="background" args={[dark ? "#111110" : "#f2f2f0"]} />
      <primitive object={wireObject} />
      {Array.from({ length: 7 }, (_, i) => (
        <group
          key={i}
          ref={(e) => {
            groups.current[i] = e
          }}
        >
          <mesh position={[0, -0.12, 0.015]}>
            <planeGeometry args={[0.065, 0.29]} />
            <meshBasicMaterial color={dark ? "#c9c8bd" : "#262722"} />
          </mesh>
          <mesh
            onClick={(e) => click(e, i)}
            onPointerOver={() => (document.body.style.cursor = "pointer")}
            onPointerOut={() => (document.body.style.cursor = "")}
          >
            <planeGeometry />
            <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}
export default function PrintLine({
  dark,
  collectionSlug,
}: {
  dark: boolean
  collectionSlug?: string
}) {
  const items = useMemo<RailItem[]>(
    () =>
      collectionSlug
        ? catalog
            .filter((p) => p.slug === collectionSlug)
            .filter((p, i, a) => a.findIndex((x) => x.key === p.key) === i)
            .map((p) => ({
              title: p.title,
              src: p.src,
              ratio: p.ratio,
              href: p.href,
              count: 0,
            }))
        : collections.map((c) => ({
            title: c.title,
            src:
              getArtworkLanding()?.href.split("/")[3] === c.slug
                ? getArtworkLanding()!.src
                : c.prints[0].src,
            ratio:
              getArtworkLanding()?.href.split("/")[3] === c.slug
                ? getArtworkLanding()!.ratio
                : c.prints[0].ratio,
            href: `/shop/prints/${c.slug}`,
            count: c.count,
          })),
    [collectionSlug]
  )
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      setSway(false)
  }, [])
  const router = useRouter()
  const [initialIndex] = useState(() => {
    const landing = getArtworkLanding()
    if (!landing) return 0
    const direct = items.findIndex((item) => item.href === landing.href)
    const grouped = items.findIndex(
      (item) => item.href === "/shop/prints/" + landing.href.split("/")[3]
    )
    return Math.max(0, direct >= 0 ? direct : grouped)
  })
  const [active, setActive] = useState(initialIndex),
    [sway, setSway] = useState(true)
  const motion = useRef({
    pos: initialIndex,
    target: initialIndex,
    velocity: 0,
    dragged: false,
  })
  const host = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; velocity: number } | null>(null)
  const c = items[active] || items[0]
  useEffect(() => {
    const node = host.current!
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      motion.current.target +=
        (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / 300
    }
    const key = (e: KeyboardEvent) => {
      if (["INPUT", "SELECT"].includes((e.target as HTMLElement).tagName))
        return
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault()
        motion.current.target =
          Math.round(motion.current.target) + (e.key === "ArrowRight" ? 1 : -1)
      }
      if (e.key === "Enter") {
        const href =
          items[mod(Math.round(motion.current.target), items.length)].href
        const source = findArtworkSource(href)
        if (collectionSlug && source)
          openArtwork(source, (path) => router.push(path))
        else router.push(href)
      }
    }
    node.addEventListener("wheel", wheel, { passive: false })
    window.addEventListener("keydown", key)
    return () => {
      node.removeEventListener("wheel", wheel)
      window.removeEventListener("keydown", key)
    }
  }, [router, items, collectionSlug])
  return (
    <div
      className="print-line"
      ref={host}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("a,button")) return
        drag.current = { x: e.clientX, velocity: 0 }
        motion.current.dragged = false
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const dx = e.clientX - d.x
        if (Math.abs(dx) > 3) motion.current.dragged = true
        motion.current.target -= dx / 300
        d.velocity = dx
        d.x = e.clientX
      }}
      onPointerUp={() => {
        if (drag.current) {
          motion.current.target -= (drag.current.velocity / 300) * 7
          motion.current.target = Math.round(motion.current.target)
        }
        drag.current = null
      }}
      onPointerLeave={() => {
        drag.current = null
        motion.current.target = Math.round(motion.current.target)
      }}
    >
      <SafeCanvas
        camera={{ position: [0, 0, 10], fov: 42, near: 0.1, far: 60 }}
        dpr={[1, 1.75]}
        flat
      >
        <Sheets
          dark={dark}
          sway={sway}
          motion={motion}
          onActive={setActive}
          items={items}
          onOpen={(i) => router.push(items[i].href)}
        />
      </SafeCanvas>
      <h1 className="line-title">
        {collectionSlug ? <Link href="/shop">← Prints</Link> : "Prints"}
      </h1>
      <div className="line-caption">
        <Link href={c.href}>
          <h2>{c.title}</h2>
          <span>
            {collectionSlug
              ? `From ${formatINR(BASE_PRINT_PRICE_INR)} — tap the middle sheet to buy`
              : `${c.count} prints — tap to open`}
          </span>
        </Link>
      </div>
      <div className="line-position">
        <button
          onClick={() =>
            (motion.current.target = Math.round(motion.current.target) - 1)
          }
          aria-label="Previous collection"
        >
          {String(active + 1).padStart(2, "0")}
        </button>
        <span />
        <button
          onClick={() =>
            (motion.current.target = Math.round(motion.current.target) + 1)
          }
          aria-label="Next collection"
        >
          {String(items.length).padStart(2, "0")}
        </button>
      </div>
      <p className="line-hint">Drag to run the line</p>
      <button
        className="sway-control"
        onClick={() => setSway(!sway)}
        aria-pressed={sway}
      >
        <span className={sway ? "sway-on" : ""} /> Sway
      </button>
    </div>
  )
}
