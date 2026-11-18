"use client"
import SafeCanvas from "./safe-canvas"
import { useFrame, useThree } from "@react-three/fiber"
import {
  Component,
  useEffect,
  useRef,
  type RefObject,
  type ReactNode,
} from "react"
import * as THREE from "three"
import { isArtworkConcealed } from "@/lib/artwork-transition"

type Kind = "image" | "heading" | "title" | "meta" | "price"
type Entry = {
  element: HTMLElement
  row: HTMLElement
  href: string
  kind: Kind
  top: number
  left: number
  width: number
  height: number
  pad: number
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  texture: THREE.Texture | null
  loading: boolean
  hover: number
  failed: boolean
}
const noise = `float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}float easeOut(float t){return t>=1.?1.:1.-pow(2.,-10.*t);}`
const imageVertex = `uniform float uVelocity;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.y+=sin(uv.x*3.14159265)*uVelocity*.09;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`
const imageFragment = `uniform sampler2D uTex;uniform float uProgress,uHover,uVelocity,uReady,uTime,uParallax;uniform vec2 uSize,uImage;varying vec2 vUv;${noise}
void main(){float progress=clamp(uProgress,0.,1.),settle=easeOut(progress);float edge=progress*1.4-.2;float grain=(noise(vUv*vec2(5.,3.)+vec2(0.,uTime*.35))-.5)*.24;float revealed=smoothstep(0.,.12,edge+grain-vUv.y);float boxRatio=uSize.x/uSize.y,imageRatio=uImage.x/max(uImage.y,1.);vec2 fit=boxRatio<imageRatio?vec2(boxRatio/imageRatio,1.):vec2(1.,imageRatio/boxRatio);float zoom=mix(1.4,1.1,settle)+uHover*.08;vec2 sampleUv=(vUv-.5)*fit/zoom+.5;sampleUv.y+=uParallax*.03;float split=uVelocity*.028+uHover*.0025;vec3 colour=vec3(texture2D(uTex,sampleUv+vec2(0.,split)).r,texture2D(uTex,sampleUv).g,texture2D(uTex,sampleUv-vec2(0.,split)).b);gl_FragColor=vec4(colour,revealed*uReady);
#include <colorspace_fragment>
}`
const textVertex = `uniform float uVelocity,uHover;uniform vec2 uSize;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.x+=p.y*uVelocity*.3*(uSize.y/uSize.x);p.x+=uHover*10./uSize.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`
const textFragment = `uniform sampler2D uTex;uniform float uProgress,uVelocity,uReady;uniform vec2 uSize;varying vec2 vUv;${noise}
void main(){float progress=easeOut(clamp(uProgress,0.,1.));vec2 sampleUv=vUv;sampleUv.y+=(1.-progress)*1.05;if(sampleUv.y>1.)discard;float split=uVelocity*4./uSize.x;vec4 red=texture2D(uTex,sampleUv+vec2(split,0.)),green=texture2D(uTex,sampleUv),blue=texture2D(uTex,sampleUv-vec2(split,0.));gl_FragColor=vec4(red.r,green.g,blue.b,max(max(red.a,green.a),blue.a)*uReady*smoothstep(0.,.3,progress));
#include <colorspace_fragment>
}`
const timing: Record<Kind, { delay: number; duration: number }> = {
  image: { delay: 0, duration: 0.9 },
  heading: { delay: 0, duration: 0.75 },
  title: { delay: 0.08, duration: 0.65 },
  meta: { delay: 0.2, duration: 0.6 },
  price: { delay: 0.15, duration: 0.6 },
}

function textTexture(entry: Entry) {
  const style = getComputedStyle(entry.element),
    scale = Math.min(devicePixelRatio || 1, 2),
    canvas = document.createElement("canvas")
  const w = Math.max(1, entry.width),
    h = Math.max(1, entry.height + 2 * entry.pad)
  canvas.width = Math.ceil(w * scale)
  canvas.height = Math.ceil(h * scale)
  const ctx = canvas.getContext("2d")!
  ctx.scale(scale, scale)
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  ctx.fillStyle = style.color
  ctx.textBaseline = "middle"
  if (style.letterSpacing !== "normal") ctx.letterSpacing = style.letterSpacing
  let text = (entry.element.textContent || "").replace(/\s+/g, " ").trim()
  if (style.textTransform === "uppercase") text = text.toUpperCase()
  const maxLines =
    style.whiteSpace === "nowrap"
      ? 1
      : parseInt(style.getPropertyValue("-webkit-line-clamp")) || 10
  const lines: string[] = []
  let current = ""
  for (const word of text.split(" ")) {
    const candidate = current ? `${current} ${word}` : word
    if (current && ctx.measureText(candidate).width > w && maxLines > 1) {
      lines.push(current)
      current = word
    } else current = candidate
  }
  lines.push(current)
  if (lines.length > maxLines)
    lines.splice(
      maxLines - 1,
      lines.length,
      lines.slice(maxLines - 1).join(" ")
    )
  let last = lines.at(-1) || ""
  if (ctx.measureText(last).width > w) {
    while (last.length > 1 && ctx.measureText(last + "…").width > w)
      last = last.slice(0, -1)
    lines[lines.length - 1] = last.trimEnd() + "…"
  }
  const lineHeight =
    parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2
  lines.forEach((line, index) =>
    ctx.fillText(
      line,
      0,
      entry.pad +
        entry.height / 2 +
        (index - (lines.length - 1) / 2) * lineHeight
    )
  )
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}
function Layer({ scroller }: { scroller: RefObject<HTMLDivElement | null> }) {
  const group = useRef<THREE.Group>(null),
    entries = useRef<Entry[]>([]),
    rowStarts = useRef(new Map<HTMLElement, number>())
  const hovered = useRef<HTMLElement | null>(null),
    velocity = useRef(0),
    trail = useRef<{ time: number; top: number }[]>([]),
    lastReveal = useRef(-Infinity),
    fontsReady = useRef(false),
    lost = useRef(false)
  const { size, gl } = useThree()
  useEffect(() => {
    const root = scroller.current,
      scene = group.current
    if (!root || !scene) return
    let alive = true
    const geometry = new THREE.PlaneGeometry(1, 1, 24, 10),
      loader = new THREE.TextureLoader()
    const list: Entry[] = Array.from(
      root.querySelectorAll<HTMLElement>("[data-list-gl]")
    ).map((element) => {
      const kind = element.dataset.listGl as Kind
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        vertexShader: kind === "image" ? imageVertex : textVertex,
        fragmentShader: kind === "image" ? imageFragment : textFragment,
        uniforms: {
          uTex: { value: null },
          uProgress: { value: 0 },
          uHover: { value: 0 },
          uVelocity: { value: 0 },
          uReady: { value: 0 },
          uTime: { value: 0 },
          uParallax: { value: 0 },
          uSize: { value: new THREE.Vector2(1, 1) },
          uImage: { value: new THREE.Vector2(1, 1) },
        },
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.visible = false
      mesh.frustumCulled = false
      scene.add(mesh)
      return {
        element,
        href: element.closest<HTMLAnchorElement>("a[href]")?.pathname || "",
        row: element.closest<HTMLElement>("[data-list-reveal]") || element,
        kind,
        mesh,
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        pad: 0,
        texture: null,
        loading: false,
        hover: 0,
        failed: false,
      }
    })
    entries.current = list
    const measure = () => {
      for (const entry of list) {
        const r = entry.element.getBoundingClientRect()
        entry.top = r.top + root.scrollTop
        entry.left = r.left
        entry.width = r.width
        entry.height = r.height
        entry.pad =
          entry.kind === "image"
            ? 0
            : Math.ceil(
                parseFloat(getComputedStyle(entry.element).fontSize) * 0.35
              )
        if (entry.texture && entry.kind !== "image") {
          const texture = textTexture(entry)
          entry.mesh.material.uniforms.uTex.value = texture
          entry.texture.dispose()
          entry.texture = texture
        }
      }
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(root.firstElementChild || root)
    const theme = new MutationObserver(measure)
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    })
    const over = (e: PointerEvent) => {
        hovered.current = (e.target as HTMLElement).closest(
          "[data-list-reveal]"
        )
      },
      leave = () => {
        hovered.current = null
      }
    root.addEventListener("pointerover", over)
    root.addEventListener("pointerleave", leave)
    window.addEventListener("resize", measure)
    document.fonts.ready.then(() => {
      if (alive) {
        fontsReady.current = true
        measure()
      }
    })
    const contextLost = () => {
      lost.current = true
      root.dataset.listFallback = ""
      list.forEach((entry) => delete entry.element.dataset.glReady)
    }
    const contextRestored = () => {
      lost.current = false
      delete root.dataset.listFallback
    }
    gl.domElement.addEventListener("webglcontextlost", contextLost)
    gl.domElement.addEventListener("webglcontextrestored", contextRestored)
    const load = (entry: Entry) => {
      if (entry.loading || entry.failed) return
      entry.loading = true
      if (entry.kind === "image") {
        const src = entry.element.dataset.src
        if (!src) {
          entry.failed = true
          entry.element.dataset.glFailed = ""
          return
        }
        loader.load(
          src,
          (texture) => {
            if (!alive) {
              texture.dispose()
              return
            }
            texture.colorSpace = THREE.SRGBColorSpace
            texture.anisotropy = 4
            entry.texture = texture
            entry.mesh.material.uniforms.uTex.value = texture
            entry.mesh.material.uniforms.uImage.value.set(
              texture.image.width,
              texture.image.height
            )
          },
          undefined,
          () => {
            entry.failed = true
            entry.element.dataset.glFailed = ""
          }
        )
      } else {
        entry.texture = textTexture(entry)
        entry.mesh.material.uniforms.uTex.value = entry.texture
      }
    }
    list.forEach((entry) => {
      entry.mesh.userData.load = () => load(entry)
    })
    return () => {
      alive = false
      resize.disconnect()
      theme.disconnect()
      root.removeEventListener("pointerover", over)
      root.removeEventListener("pointerleave", leave)
      window.removeEventListener("resize", measure)
      gl.domElement.removeEventListener("webglcontextlost", contextLost)
      gl.domElement.removeEventListener("webglcontextrestored", contextRestored)
      list.forEach((entry) => {
        delete entry.element.dataset.glReady
        scene.remove(entry.mesh)
        entry.mesh.material.dispose()
        entry.texture?.dispose()
      })
      geometry.dispose()
      entries.current = []
      rowStarts.current.clear()
      trail.current = []
    }
  }, [scroller, gl])
  useFrame((state, delta) => {
    const root = scroller.current
    if (!root || lost.current) return
    const scroll = root.scrollTop,
      height = root.clientHeight,
      time = state.clock.elapsedTime,
      now = performance.now()
    const samples = trail.current
    samples.push({ time: now, top: scroll })
    while (samples.length > 2 && now - samples[0].time > 100) samples.shift()
    const speed =
        ((scroll - samples[0].top) / Math.max(16, now - samples[0].time)) *
        1000,
      target = Math.max(-1, Math.min(1, speed / 2000))
    velocity.current +=
      (target - velocity.current) *
      Math.min(
        1,
        delta * (Math.abs(target) > Math.abs(velocity.current) ? 14 : 4)
      )
    root.style.setProperty("--list-scroll-velocity", String(velocity.current))
    const candidates = new Map<
      HTMLElement,
      { top: number; ready: boolean; failed: boolean }
    >()
    for (const entry of entries.current) {
      const y = entry.top - scroll
      if (
        entry.row.hasAttribute("data-return-target") &&
        !rowStarts.current.has(entry.row)
      )
        rowStarts.current.set(entry.row, time - 10)
      if (
        y + entry.height > -height &&
        y < height * 2 &&
        !entry.loading &&
        (fontsReady.current || entry.kind === "image")
      )
        entry.mesh.userData.load?.()
      if (
        !rowStarts.current.has(entry.row) &&
        y < height * 0.94 &&
        y + entry.height > 0
      ) {
        const prev = candidates.get(entry.row)
        candidates.set(entry.row, {
          top: Math.min(y, prev?.top ?? y),
          ready: (prev?.ready ?? true) && !!entry.texture,
          failed: (prev?.failed ?? false) || entry.failed,
        })
      }
    }
    for (const [row, item] of [...candidates].sort(
      (a, b) => a[1].top - b[1].top
    )) {
      if (!item.ready && !item.failed) continue
      const start = Math.max(time + 0.02, lastReveal.current + 0.13)
      rowStarts.current.set(row, start)
      lastReveal.current = start
    }
    for (const entry of entries.current) {
      const y = entry.top - scroll,
        mesh = entry.mesh,
        u = mesh.material.uniforms,
        img = entry.element.querySelector("img")
      const inView =
        !!entry.texture &&
        y + entry.height + entry.pad > 0 &&
        y - entry.pad < size.height
      mesh.visible =
        inView &&
        img?.style.opacity !== "0" &&
        (entry.kind !== "image" || !isArtworkConcealed(entry.href))
      if (!inView) continue
      entry.element.dataset.glReady = ""
      const h = entry.height + 2 * entry.pad
      mesh.position.set(
        entry.left + entry.width / 2 - size.width / 2,
        size.height / 2 - (y + entry.height / 2),
        0
      )
      mesh.scale.set(entry.width, h, 1)
      u.uSize.value.set(entry.width, h)
      const start = rowStarts.current.get(entry.row),
        schedule = timing[entry.kind]
      u.uProgress.value =
        start === undefined
          ? 0
          : Math.max(
              0,
              Math.min(1, (time - start - schedule.delay) / schedule.duration)
            )
      u.uReady.value += (1 - u.uReady.value) * 0.18
      entry.hover += (Number(hovered.current === entry.row) - entry.hover) * 0.1
      u.uHover.value = entry.kind === "meta" ? 0 : entry.hover
      u.uVelocity.value = velocity.current
      u.uTime.value = time
      u.uParallax.value = ((y + entry.height / 2) / height - 0.5) * 2
      if (entry.kind === "image") {
        const p = u.uProgress.value,
          e = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)
        entry.element.style.setProperty(
          "--list-image-zoom",
          String(1.4 + (1.1 - 1.4) * e + entry.hover * 0.08)
        )
      }
    }
  })
  return <group ref={group} />
}
class MotionBoundary extends Component<
  { children: ReactNode; onFallback: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFallback()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}
export default function ListMotion({
  scroller,
  onFallback,
}: {
  scroller: RefObject<HTMLDivElement | null>
  onFallback: () => void
}) {
  return (
    <MotionBoundary onFallback={onFallback}>
      <div className="artwork-list-motion" aria-hidden="true">
        <SafeCanvas
          onUnavailable={onFallback}
          orthographic
          camera={{ position: [0, 0, 100], near: 0.1, far: 1000, zoom: 1 }}
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true }}
          fallback={null}
        >
          <Layer scroller={scroller} />
        </SafeCanvas>
      </div>
    </MotionBoundary>
  )
}
