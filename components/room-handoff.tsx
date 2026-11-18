"use client"
import { useEffect, useState } from "react"

export function isHandheldARDevice() {
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  )
}

export default function RoomHandoff({
  href,
  onClose,
}: {
  href: string
  onClose: () => void
}) {
  const [qr, setQr] = useState("")
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setQr("")
    setFailed(false)
    const url = new URL(href, window.location.origin).href
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(url, {
          width: 416,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        })
      )
      .then((image) => {
        if (active) setQr(image)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [href, attempt])
  useEffect(() => {
    const root = document.documentElement,
      body = document.body
    const previousRoot = root.style.overflow,
      previousBody = body.style.overflow
    root.style.overflow = "hidden"
    body.style.overflow = "hidden"
    return () => {
      root.style.overflow = previousRoot
      body.style.overflow = previousBody
    }
  }, [])
  return (
    <div className="room-handoff-veil" onClick={onClose}>
      <section
        className="room-handoff-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-handoff-title"
        aria-describedby="room-handoff-description"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="room-handoff-title">See it on your wall</h2>
        <p id="room-handoff-description">
          Scan this with your phone’s camera. The print opens at its real size,
          ready to place.
        </p>
        <div className="room-handoff-qr" aria-busy={!qr && !failed}>
          {qr ? (
            <img
              src={qr}
              alt="Scan to open this print’s wall preview with the selected frame and size"
              width={208}
              height={208}
            />
          ) : failed ? (
            <div role="status">
              <p>Could not load the QR code.</p>
              <button onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </button>
            </div>
          ) : (
            <span role="status">Preparing QR code…</span>
          )}
        </div>
        <p className="room-handoff-device">
          iPhone, or an Android phone with ARCore.
        </p>
        <button className="room-handoff-close" onClick={onClose}>
          Close
        </button>
      </section>
    </div>
  )
}
