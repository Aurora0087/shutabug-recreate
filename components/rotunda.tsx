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
import { ArrowLeft, ArrowRight } from "lucide-react"
import * as THREE from "three"
import collections from "@/lib/collections.json"
import {
  openArtwork,
  registerArtworkSource,
  getArtworkLanding,
  isArtworkConcealed,
} from "@/lib/artwork-transition"
import { projectedArtwork } from "@/lib/project-artwork"

type Print = (typeof collections)[number]["prints"][number]
type Place = { collection: number; outer: Print | null; inner: Print | null }
type Walk = { at: number; target: number; moved: number }
const STEP = 2.5 / 12
const wrap = (n: number, total: number) => ((n % total) + total) % total
const basePlaces: Place[] = collections.flatMap((c, collection) =>
  [null, ...c.prints.slice(0, 5)].map((outer, n) => ({
    collection,
    outer,
    inner: n % 2 === 0 ? (c.prints[5 + n / 2] ?? null) : null,
  }))
)
// The room lighting is independent of the surrounding UI theme.
const roomPalette = {
  bg: "#11151f",
  floor: "#2a2a2e",
  inner: "#e2e0da",
  outer: "#e9e7e1",
  lamp: 0.55,
  pool: 0.16,
}

function textTexture(title: string, note: string, plaque = false) {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = plaque ? 640 : 256
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = plaque ? "#efede7" : "#f7f6f2"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#1a1a1a"
  ctx.textBaseline = "top"
  if (plaque) {
    ctx.font = '400 64px "kon-tiki-aloha-jf", Arial'
    let line = "",
      y = 70
    for (const word of title.toUpperCase().split(/\s+/)) {
      const next = line ? line + " " + word : word
      if (ctx.measureText(next).width > 412 && line) {
        ctx.fillText(line, 50, y)
        y += 70
        line = word
      } else line = next
    }
    ctx.fillText(line, 50, y)
    ctx.font = "26px monospace"
    ctx.globalAlpha = 0.6
    ctx.fillText(note.toUpperCase(), 50, y + 100)
  } else {
    const fit = (str: string) => {
      while (ctx.measureText(str).width > 452) str = str.slice(0, -2) + "…"
      return str
    }
    ctx.font = "600 54px Kalice,serif"
    ctx.fillText("Mayowa Alabi", 30, 30)
    ctx.font = "italic 52px Kalice,serif"
    ctx.fillText(fit(title), 30, 104)
    ctx.font = "26px monospace"
    ctx.globalAlpha = 0.6
    ctx.fillText(fit(note.toUpperCase()), 30, 200)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
function Room({
  places,
  dark,
  walk,
  dragged,
  onCollection,
  onFocused,
  onReady,
  onTip,
}: {
  places: Place[]
  dark: boolean
  walk: MutableRefObject<Walk>
  dragged: MutableRefObject<boolean>
  onCollection: (n: number) => void
  onFocused: (v: boolean) => void
  onReady: () => void
  onTip: (v: string) => void
}) {
  const { camera, pointer, gl } = useThree()
  const router = useRouter()
  const palette = roomPalette
  const outer = useRef<(THREE.Group | null)[]>([]),
    inner = useRef<(THREE.Group | null)[]>([])
  const outside = useRef<(THREE.Mesh | null)[]>([]),
    inside = useRef<(THREE.Mesh | null)[]>([])
  const outerLabel = useRef<(THREE.Mesh | null)[]>([]),
    innerLabel = useRef<(THREE.Mesh | null)[]>([])
  const focus = useRef<THREE.Object3D | null>(null),
    focusTime = useRef(0),
    lastCollection = useRef(-1),
    lastFocused = useRef(false)
  const slots = useRef<number[]>([]),
    textures = useRef(new Map<string, THREE.Texture>()),
    ready = useRef(false)
  const loader = useMemo(() => new THREE.TextureLoader(), [])
  const plaques = useMemo(
    () =>
      collections.map((c) => textTexture(c.title, `${c.count} prints`, true)),
    []
  )
  const labels = useMemo(() => {
    const labels = new Map<string, THREE.Texture>()
    for (const place of places)
      for (const p of [place.outer, place.inner])
        if (p && !labels.has(p.key))
          labels.set(
            p.key,
            textTexture(p.title, collections[place.collection].title)
          )
    return labels
  }, [places])
  const landing = useRef(getArtworkLanding()),
    landingFocused = useRef(false),
    landingCameraReady = useRef(false)
  useEffect(() => {
    const seen = new Set<string>(),
      cleanup: (() => void)[] = []
    places.forEach((place) =>
      [place.outer, place.inner].forEach((p) => {
        if (!p || seen.has(p.href)) return
        seen.add(p.href)
        cleanup.push(
          registerArtworkSource(p.href, () => {
            if (!ready.current) return null
            const slot = slots.current.findIndex((index) => {
              const at = places[wrap(index, places.length)]
              return at.outer?.href === p.href || at.inner?.href === p.href
            })
            if (slot < 0) return null
            const at = places[wrap(slots.current[slot], places.length)],
              mesh =
                at.outer?.href === p.href
                  ? outside.current[slot]
                  : inside.current[slot]
            if (
              !mesh ||
              !(
                (mesh.material as THREE.MeshBasicMaterial).map?.image as
                  { width?: number } | undefined
              )?.width
            )
              return null
            const corners = projectedArtwork(mesh, camera, gl.domElement)
            if (!corners) return null
            return {
              href: p.href,
              src: p.src,
              alt: p.title,
              corners,
              conceal: () => {
                mesh.visible = false
                return () => {
                  mesh.visible = true
                }
              },
            }
          })
        )
      })
    )
    return () => cleanup.forEach((dispose) => dispose())
  }, [places, camera, gl])
  const lamp = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = c.height = 256
    const ctx = c.getContext("2d")!
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    gradient.addColorStop(0, "rgba(255,255,255,1)")
    gradient.addColorStop(0.35, "rgba(255,255,255,.55)")
    gradient.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(c)
  }, [])
  const texture = (src: string) => {
    let t = textures.current.get(src)
    if (!t) {
      t = loader.load(src)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      textures.current.set(src, t)
    }
    return t
  }
  const animated = useRef({ start: 0 })
  const vectors = useMemo(
    () => ({
      position: new THREE.Vector3(),
      look: new THREE.Vector3(),
      desired: new THREE.Vector3(),
      target: new THREE.Vector3(),
      direction: new THREE.Vector3(),
    }),
    []
  )
  const [reduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") focus.current = null
    }
    window.addEventListener("keydown", escape)
    const cache = textures.current
    return () => {
      window.removeEventListener("keydown", escape)
      for (const t of cache.values()) t.dispose()
      plaques.forEach((t) => t.dispose())
      labels.forEach((t) => t.dispose())
      lamp.dispose()
    }
  }, [plaques, labels, lamp])
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30),
      w = walk.current,
      a = animated.current,
      now = performance.now()
    if (!a.start) {
      a.start = now
      vectors.position.set(9.7 * Math.sin(w.at), 1.55, 9.7 * Math.cos(w.at))
      const look = w.at + 0.32 + 0.25 * pointer.x
      vectors.look.set(
        9.7 * Math.sin(look),
        1.5 + 0.25 * pointer.y,
        9.7 * Math.cos(look)
      )
    }
    if (focus.current && w.moved > focusTime.current) focus.current = null
    if (!focus.current && !reduced) w.target += 0.0075 * dt
    w.at += (w.target - w.at) * Math.min(1, 2.4 * dt)
    const angle = w.at
    vectors.desired.set(
      9.7 * Math.sin(angle),
      1.55 + (reduced ? 0 : 0.012 * Math.sin(state.clock.elapsedTime * 1.4)),
      9.7 * Math.cos(angle)
    )
    const ahead = angle + 0.32 + 0.25 * pointer.x
    vectors.target.set(
      9.7 * Math.sin(ahead),
      1.5 + 0.25 * pointer.y,
      9.7 * Math.cos(ahead)
    )
    if (focus.current) {
      focus.current.getWorldPosition(vectors.target)
      focus.current.getWorldDirection(vectors.direction)
      vectors.desired
        .copy(vectors.target)
        .addScaledVector(vectors.direction, 2.2)
      vectors.target.y -= 0.3
    }
    if (landing.current && focus.current && !landingCameraReady.current) {
      vectors.position.copy(vectors.desired)
      vectors.look.copy(vectors.target)
      landingCameraReady.current = true
    }
    vectors.position.lerp(
      vectors.desired,
      Math.min(1, dt * (reduced ? 20 : 2.8))
    )
    vectors.look.lerp(vectors.target, Math.min(1, dt * (reduced ? 20 : 2.8)))
    // Orbit interpolation can cut across the inner wall on a large jump.
    // Clamp every normal walking frame to the centre of the corridor.
    if (!focus.current) {
      const radius = Math.hypot(vectors.position.x, vectors.position.z)
      if (radius > 0) {
        vectors.position.x *= 9.7 / radius
        vectors.position.z *= 9.7 / radius
      }
    }
    camera.position.copy(vectors.position)
    camera.lookAt(vectors.look)
    gl.domElement.dataset.cameraRadius = Math.hypot(
      camera.position.x,
      camera.position.z
    ).toFixed(4)
    const base = Math.floor(angle / STEP)
    const setArt = (
      mesh: THREE.Mesh | null,
      p: Print | null,
      collection: number,
      label: THREE.Mesh | null,
      isInner: boolean
    ) => {
      if (!mesh) return
      mesh.visible = !p || !isArtworkConcealed(p.href)
      const mat = mesh.material as THREE.MeshBasicMaterial
      const ratio = p ? Math.min(1.5, Math.max(0.55, p.ratio)) : 1.15 / 1.44
      const height = p
        ? isInner
          ? Math.min(1.305, (STEP * 14.8 - 0.7) / ratio)
          : 1.45
        : 1.44
      mesh.scale.set(p ? height * ratio : 1.15, height, 1)
      mesh.position.y = p ? 1.6 : 1.55
      const tex = p ? texture(p.src) : plaques[collection]
      if (mat.map !== tex) {
        mat.map = tex
        mat.needsUpdate = true
      }
      if (label) {
        label.visible = !!p
        if (p) {
          const lm = label.material as THREE.MeshBasicMaterial
          const tex = labels.get(p.key)!
          if (lm.map !== tex) {
            lm.map = tex
            lm.needsUpdate = true
          }
          label.position.set(
            (-height * ratio) / 2 + 0.25,
            1.6 - height / 2 - 0.225,
            0.035
          )
        }
      }
    }
    for (let i = 0; i < 15; i++) {
      const index = base + i - 3,
        place = places[wrap(index, places.length)],
        theta = index * STEP
      slots.current[i] = index
      const out = outer.current[i]
      if (out) {
        out.position.set(11.97 * Math.sin(theta), 0, 11.97 * Math.cos(theta))
        out.rotation.y = theta + Math.PI
        setArt(
          outside.current[i],
          place.outer,
          place.collection,
          outerLabel.current[i],
          false
        )
      }
      const inn = inner.current[i]
      if (inn) {
        inn.visible = !!place.inner
        if (place.inner) {
          inn.position.set(
            7.43 * Math.sin(theta + 0.04),
            0,
            7.43 * Math.cos(theta + 0.04)
          )
          inn.rotation.y = theta + 0.04
          setArt(
            inside.current[i],
            place.inner,
            place.collection,
            innerLabel.current[i],
            true
          )
        }
      }
    }
    if (landing.current && !landingFocused.current) {
      const slot = slots.current.findIndex((index) => {
        const place = places[wrap(index, places.length)]
        return (
          place.outer?.href === landing.current!.href ||
          place.inner?.href === landing.current!.href
        )
      })
      if (slot >= 0) {
        const place = places[wrap(slots.current[slot], places.length)],
          mesh =
            place.outer?.href === landing.current.href
              ? outside.current[slot]
              : inside.current[slot]
        if (mesh) {
          focus.current = mesh
          focusTime.current = performance.now()
          landingFocused.current = true
        }
      }
    }
    const selected =
      places[wrap(Math.round((angle + 0.25) / STEP), places.length)].collection
    if (selected !== lastCollection.current) {
      lastCollection.current = selected
      onCollection(selected)
    }
    const focused = !!focus.current
    if (lastFocused.current !== focused) {
      lastFocused.current = focused
      onFocused(focused)
    }
    if (!ready.current && now - a.start > 300) {
      ready.current = true
      onReady()
    }
  })
  const open = (e: ThreeEvent<MouseEvent>, slot: number, isInner: boolean) => {
    e.stopPropagation()
    if (dragged.current) return
    if (focus.current !== e.object) {
      focus.current = e.object
      focusTime.current = performance.now()
      onTip("Click again to open")
      return
    }
    const place = places[wrap(slots.current[slot], places.length)],
      p = isInner ? place.inner : place.outer
    if (p) {
      const corners = projectedArtwork(e.object, camera, gl.domElement)
      if (corners) {
        const object = e.object
        openArtwork(
          {
            href: p.href,
            src: p.src,
            alt: p.title,
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
        return
      }
    }
    router.push(
      p ? p.href : `/collection/${collections[place.collection].slug}`
    )
  }
  const hover = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    gl.domElement.style.cursor = "pointer"
    onTip(focus.current === e.object ? "Open the print" : "Look closer")
  }
  const out = () => {
    gl.domElement.style.cursor = "grab"
    onTip("")
  }
  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <fog attach="fog" args={[palette.bg, 8, 24]} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={() => (focus.current = null)}
      >
        <ringGeometry args={[7.2, 12.2, 160]} />
        <meshBasicMaterial
          color={palette.floor}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <mesh position={[0, 3.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[7.2, 12.2, 160]} />
        <meshBasicMaterial
          color={palette.bg}
          toneMapped={false}
          fog={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 1.8, 0]} onClick={() => (focus.current = null)}>
        <cylinderGeometry args={[12, 12, 3.6, 160, 1, true]} />
        <meshBasicMaterial
          color={palette.outer}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 1.8, 0]} onClick={() => (focus.current = null)}>
        <cylinderGeometry args={[7.4, 7.4, 3.6, 120, 1, true]} />
        <meshBasicMaterial
          color={palette.inner}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </mesh>
      {Array.from({ length: 15 }, (_, i) => (
        <group key={i}>
          <group
            ref={(e) => {
              outer.current[i] = e
            }}
          >
            <mesh position={[0, 1.8, 0.01]}>
              <planeGeometry args={[2.5, 3]} />
              <meshBasicMaterial
                color="#fff1d6"
                map={lamp}
                transparent
                opacity={palette.lamp}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <mesh position={[0, 0.02, 1.1]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.6, 2]} />
              <meshBasicMaterial
                color="#ffe8c2"
                map={lamp}
                transparent
                opacity={palette.pool}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <mesh
              ref={(e) => {
                outside.current[i] = e
              }}
              position={[0, 1.6, 0.03]}
              onClick={(e) => open(e, i, false)}
              onPointerOver={hover}
              onPointerOut={out}
            >
              <planeGeometry />
              <meshBasicMaterial toneMapped={false} />
            </mesh>
            <mesh
              ref={(e) => {
                outerLabel.current[i] = e
              }}
            >
              <planeGeometry args={[0.5, 0.25]} />
              <meshBasicMaterial toneMapped={false} />
            </mesh>
          </group>
          <group
            ref={(e) => {
              inner.current[i] = e
            }}
          >
            <mesh position={[0, 1.8, 0.01]}>
              <planeGeometry args={[2.3, 2.8]} />
              <meshBasicMaterial
                color="#fff1d6"
                map={lamp}
                transparent
                opacity={palette.lamp}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <mesh
              ref={(e) => {
                inside.current[i] = e
              }}
              position={[0, 1.6, 0.03]}
              onClick={(e) => open(e, i, true)}
              onPointerOver={hover}
              onPointerOut={out}
            >
              <planeGeometry />
              <meshBasicMaterial toneMapped={false} />
            </mesh>
            <mesh
              ref={(e) => {
                innerLabel.current[i] = e
              }}
            >
              <planeGeometry args={[0.5, 0.25]} />
              <meshBasicMaterial toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  )
}
export default function Rotunda({ dark }: { dark: boolean }) {
  const [landing] = useState(() => getArtworkLanding())
  const [places] = useState(() => {
    const places = basePlaces.map((place) => ({ ...place }))
    if (
      landing &&
      !places.some(
        (place) =>
          place.outer?.href === landing.href ||
          place.inner?.href === landing.href
      )
    ) {
      const collection = collections.findIndex(
          (c) => c.slug === landing.href.split("/")[3]
        ),
        slot = places.findIndex(
          (place) => place.collection === collection && place.outer
        )
      if (slot >= 0)
        places[slot].outer = {
          href: landing.href,
          key: landing.key,
          large: landing.src,
          src: landing.src,
          ratio: landing.ratio,
          title: landing.alt,
        }
    }
    return places
  })
  const initialIndex = landing
    ? Math.max(
        0,
        places.findIndex(
          (place) =>
            place.outer?.href === landing.href ||
            place.inner?.href === landing.href
        )
      )
    : 0
  const initialAngle = landing ? initialIndex * STEP - 0.3 : -0.2
  const walk = useRef<Walk>({
      at: initialAngle,
      target: initialAngle,
      moved: 0,
    }),
    dragged = useRef(false),
    host = useRef<HTMLDivElement>(null),
    cursor = useRef<HTMLSpanElement>(null)
  const drag = useRef<{
    id: number
    x: number
    y: number
    t: number
    v: number
  } | null>(null)
  const [active, setActive] = useState(0),
    [focused, setFocused] = useState(false),
    [ready, setReady] = useState(false),
    [tip, setTip] = useState("")
  const c = collections[active]
  useEffect(() => {
    const node = host.current!
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      walk.current.target +=
        0.0009 *
        Math.max(
          -120,
          Math.min(120, (e.deltaX + e.deltaY) * (e.deltaMode === 1 ? 16 : 1))
        )
      walk.current.moved = performance.now()
    }
    const key = (e: KeyboardEvent) => {
      if (
        ["INPUT", "SELECT", "TEXTAREA"].includes(
          (e.target as HTMLElement).tagName
        )
      )
        return
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault()
        walk.current.target += (e.key === "ArrowLeft" ? -2 : 2) * STEP
        walk.current.moved = performance.now()
      }
    }
    node.addEventListener("wheel", wheel, { passive: false })
    window.addEventListener("keydown", key)
    return () => {
      node.removeEventListener("wheel", wheel)
      window.removeEventListener("keydown", key)
    }
  }, [])
  const next = (direction: number) => {
    const selected = wrap(active + direction, collections.length)
    const currentIndex = Math.round((walk.current.target + 0.25) / STEP)
    const cycle = Math.floor(currentIndex / places.length)
    let index =
      places.findIndex((p) => p.collection === selected) + cycle * places.length
    if (direction > 0 && selected <= active) index += places.length
    if (direction < 0 && selected >= active) index -= places.length
    walk.current.target = index * STEP - 0.3
    walk.current.moved = performance.now()
  }
  return (
    <div
      ref={host}
      className={`rotunda dark-gallery-room ${ready ? "scene-ready" : ""}`}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button,a")) return
        drag.current = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          t: e.timeStamp,
          v: 0,
        }
        dragged.current = false
      }}
      onPointerMove={(e) => {
        if (cursor.current)
          cursor.current.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        const dx = e.clientX - d.x,
          dy = e.clientY - d.y,
          delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy
        if (Math.abs(delta) > 3) {
          dragged.current = true
          walk.current.moved = performance.now()
        }
        walk.current.target -= 0.0022 * delta
        d.v = 0.6 * d.v + (0.4 * delta) / Math.max(1, e.timeStamp - d.t)
        d.x = e.clientX
        d.y = e.clientY
        d.t = e.timeStamp
      }}
      onPointerUp={(e) => {
        const d = drag.current
        if (d && dragged.current && e.timeStamp - d.t < 80) {
          walk.current.target -= 220 * Math.max(-3, Math.min(3, d.v)) * 0.0022
          walk.current.moved = performance.now()
        }
        drag.current = null
      }}
      onPointerCancel={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
    >
      <div className="rotunda-canvas">
        <SafeCanvas
          camera={{ far: 60, fov: 62, near: 0.1, position: [0, 1.55, 9.7] }}
          dpr={[1, 2]}
          flat
          gl={{ antialias: true }}
          fallback={
            <div className="webgl-fallback">
              Your browser cannot open the 3D room. Switch to List to explore
              every collection.
            </div>
          }
        >
          <Room
            places={places}
            dark={dark}
            walk={walk}
            dragged={dragged}
            onCollection={setActive}
            onFocused={setFocused}
            onReady={() => setReady(true)}
            onTip={setTip}
          />
        </SafeCanvas>
      </div>
      {ready && (
        <>
          <div className={`room-caption ${focused ? "focused" : ""}`}>
            <p>You are walking past</p>
            <h1>{c.title}</h1>
            <Link href={`/collection/${c.slug}`}>Enter the collection →</Link>
          </div>
          <div className="room-walk-controls">
            <div className="room-nav">
              <button aria-label="Previous collection" onClick={() => next(-1)}>
                <ArrowLeft size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <button aria-label="Next collection" onClick={() => next(1)}>
                <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
            <p className="walk-hint">
              <span>
                {focused
                  ? "Click the painting to open it"
                  : "Scroll or drag to walk round"}
              </span>
              <span>
                {focused
                  ? "Esc or click away to step back"
                  : "Click a painting to look closer"}
              </span>
            </p>
          </div>
        </>
      )}
      {!ready && (
        <div className="room-loading">
          Entering the gallery<span>…</span>
        </div>
      )}
      <span ref={cursor} className={`room-cursor ${tip ? "visible" : ""}`}>
        <span>{tip}</span>
      </span>
    </div>
  )
}
