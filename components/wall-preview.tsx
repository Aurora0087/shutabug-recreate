"use client"
import { createElement, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowUpRight,
  RotateCcw,
  Smartphone,
  X,
  Copy,
} from "lucide-react"
import {
  PRINT_SIZES,
  PRINT_FRAMES,
  printSize,
  printFrame,
  printDimensions,
  wallPreviewHref,
  productReturnHref,
  type PrintSize,
  type PrintFrame,
} from "@/lib/ar-options"

type Product = {
  key: string
  title: string
  collection: string
  href: string
  src: string
  ratio: number
}
type ModelViewer = HTMLElement & {
  loaded: boolean
  canActivateAR: boolean
  activateAR: () => Promise<void>
  cameraOrbit: string
  fieldOfView: string
  jumpCameraToGoal: () => void
}

export default function WallPreview({ product }: { product: Product }) {
  const params = useSearchParams(),
    router = useRouter()
  const size = printSize(params.get("size")),
    frame = printFrame(params.get("frame"))
  const dimensions = printDimensions(size, frame, product.ratio)
  const [registered, setRegistered] = useState(false),
    [status, setStatus] = useState<"building" | "ready" | "failed">("building")
  const [supported, setSupported] = useState<boolean | null>(null),
    [notice, setNotice] = useState(""),
    [retry, setRetry] = useState(0)
  const [share, setShare] = useState(false),
    [qr, setQr] = useState(""),
    [shareUrl, setShareUrl] = useState(""),
    [local, setLocal] = useState(false)
  const viewer = useRef<ModelViewer | null>(null)
  const modelSrc = useMemo(
    () =>
      `/api/ar-model?${new URLSearchParams({ art: product.key, size, frame, ...(retry ? { retry: String(retry) } : {}) })}`,
    [product.key, size, frame, retry]
  )
  const backHref = productReturnHref(product.href, size, frame)
  useEffect(() => {
    let active = true
    import("@google/model-viewer")
      .then(() => {
        if (active) setRegistered(true)
      })
      .catch(() => {
        if (active) setStatus("failed")
      })
    return () => {
      active = false
    }
  }, [retry])
  useEffect(() => {
    setStatus("building")
    setSupported(null)
    setNotice("")
    if (!registered) return
    const node = viewer.current
    if (!node) return
    const loaded = () => {
      setStatus("ready")
      setSupported(node.canActivateAR)
    }
    const failed = () => {
      setStatus("failed")
      setSupported(false)
    }
    const ar = (e: Event) => {
      const state = (e as CustomEvent<{ status: string }>).detail.status
      if (state === "failed")
        setNotice("Could not start AR. Try your phone’s supported browser.")
      else if (state === "session-started")
        setNotice("Move your phone slowly to find a wall.")
      else if (state === "object-placed")
        setNotice("Your print is placed at its selected size.")
      else setNotice("")
    }
    node.addEventListener("load", loaded)
    node.addEventListener("error", failed)
    node.addEventListener("ar-status", ar)
    if (node.loaded) loaded()
    return () => {
      node.removeEventListener("load", loaded)
      node.removeEventListener("error", failed)
      node.removeEventListener("ar-status", ar)
    }
  }, [registered, modelSrc])
  useEffect(() => {
    let active = true
    const url = new URL(
      wallPreviewHref(product.href, size, frame),
      location.origin
    ).href
    setShareUrl(url)
    setLocal(["localhost", "127.0.0.1", "[::1]"].includes(location.hostname))
    setQr("")
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(url, {
          width: 256,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#111110", light: "#ffffff" },
        })
      )
      .then((image) => {
        if (active) setQr(image)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [product.href, size, frame])
  useEffect(() => {
    if (!share) return
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShare(false)
      if (event.key === "Tab") {
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".wall-share-card button,.wall-share-card input"
          )
        )
        const first = nodes[0],
          last = nodes[nodes.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener("keydown", close)
    return () => {
      window.removeEventListener("keydown", close)
      document.querySelector<HTMLButtonElement>("[data-wall-share]")?.focus()
    }
  }, [share])
  const change = (nextSize: PrintSize, nextFrame: PrintFrame) =>
    router.replace(wallPreviewHref(product.href, nextSize, nextFrame), {
      scroll: false,
    })
  const activate = async () => {
    setNotice("")
    try {
      await viewer.current?.activateAR()
    } catch {
      setNotice(
        "AR could not open. Use Safari on iPhone/iPad or an AR-capable Android browser."
      )
    }
  }
  const reset = () => {
    if (!viewer.current) return
    viewer.current.cameraOrbit = "0deg 75deg 105%"
    viewer.current.fieldOfView = "30deg"
    viewer.current.jumpCameraToGoal()
  }
  return (
    <section className="wall-preview" aria-label="See it on your wall">
      <div className="wall-preview-heading">
        <div>
          <h1>{product.collection}</h1>
          <p>
            {product.title} — {PRINT_SIZES[size].label}, {frame.toLowerCase()}
          </p>
        </div>
        <Link
          href={backHref}
          className="wall-close"
          aria-label="Back to the print"
        >
          <X size={20} />
        </Link>
      </div>
      <div className="wall-preview-stage" aria-busy={status === "building"}>
        {registered &&
          createElement(
            "model-viewer",
            {
              key: modelSrc,
              ref: viewer,
              src: modelSrc,
              alt: `${product.title}, ${PRINT_SIZES[size].label}, ${frame}`,
              ar: true,
              "ar-placement": "wall",
              "ar-modes": "webxr scene-viewer quick-look",
              "ar-scale": "fixed",
              "xr-environment": true,
              "camera-controls": true,
              "camera-orbit": "0deg 75deg 105%",
              "field-of-view": "30deg",
              "touch-action": "pan-y",
              "shadow-intensity": "1",
              "shadow-softness": "1",
              exposure: "1.05",
              "interaction-prompt": "none",
              loading: "eager",
            },
            createElement("span", { slot: "ar-button", hidden: true }),
            createElement("span", { slot: "progress-bar", hidden: true })
          )}
        {status !== "ready" && (
          <div className="wall-preview-holding" role="status">
            <img src={product.src} alt="" />
            <p>
              {status === "failed"
                ? "Could not prepare this print."
                : "Building the piece…"}
            </p>
            {status === "failed" && (
              <button
                onClick={() => {
                  setStatus("building")
                  setRetry((n) => n + 1)
                }}
              >
                Try again
              </button>
            )}
          </div>
        )}
        {status === "ready" && (
          <button className="wall-reset" onClick={reset}>
            <RotateCcw size={14} /> Reset view
          </button>
        )}
      </div>
      <div className="wall-preview-controls">
        <div className="wall-options">
          <label>
            Size
            <select
              aria-label="Preview print size"
              value={size}
              onChange={(e) => change(e.target.value as PrintSize, frame)}
            >
              {Object.entries(PRINT_SIZES).map(([code, item]) => (
                <option key={code} value={code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Frame
            <select
              aria-label="Preview print frame"
              value={frame}
              onChange={(e) => change(size, e.target.value as PrintFrame)}
            >
              {PRINT_FRAMES.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="wall-measure">
          <strong>
            {Math.round(dimensions.outerWidth * 100)} ×{" "}
            {Math.round(dimensions.outerHeight * 100)}
          </strong>{" "}
          cm on the wall
        </p>
        <button
          className="wall-ar-button"
          disabled={status !== "ready" || supported !== true}
          onClick={activate}
        >
          {status === "building"
            ? "Preparing your print…"
            : status === "failed"
              ? "Preview unavailable"
              : supported
                ? "See it on your wall"
                : "AR not available on this device"}
        </button>
        <p className="wall-device-note">
          {notice ||
            (supported
              ? "Point your phone at a wall and follow the placement guide."
              : "Use an iPhone/iPad or an Android phone with ARCore. You can rotate and zoom the preview here.")}
        </p>
        <div className="wall-links">
          <Link href={backHref}>
            <ArrowLeft size={13} /> Back to the print
          </Link>
          <button data-wall-share onClick={() => setShare(true)}>
            <Smartphone size={15} /> Open on your phone{" "}
            <ArrowUpRight size={13} />
          </button>
        </div>
      </div>
      {share && (
        <div className="wall-share-overlay" onClick={() => setShare(false)}>
          <section
            className="wall-share-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wall-share-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="wall-share-close"
              autoFocus
              aria-label="Close phone handoff"
              onClick={() => setShare(false)}
            >
              <X size={19} />
            </button>
            <h2 id="wall-share-title">See it on your wall</h2>
            <p>
              Scan with your phone’s camera. Your artwork, frame and size come
              with you.
            </p>
            {qr ? (
              <img
                className="wall-qr"
                src={qr}
                alt="QR code to open this print’s wall preview on your phone"
              />
            ) : (
              <p role="status">Preparing QR code…</p>
            )}
            <label className="wall-share-label">
              Preview link
              <input
                aria-label="Wall preview link"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <button
              className="wall-copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl)
                  setNotice("Preview link copied.")
                } catch {
                  setNotice("Select and copy the preview link above.")
                }
              }}
            >
              <Copy size={14} /> Copy link
            </button>
            {local && (
              <p className="wall-local-note">
                Open the hosted site on your phone for AR. This computer’s
                localhost address won’t work on another device.
              </p>
            )}
            <p role="status" className="wall-share-status">
              {notice}
            </p>
          </section>
        </div>
      )}
    </section>
  )
}
