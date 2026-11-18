"use client"
import { Canvas, type CanvasProps } from "@react-three/fiber"
import { useCallback, useEffect, useState } from "react"
import { WebGLRenderer, type WebGLRendererParameters } from "three"
import {
  canUseWebGL,
  markWebGLUnavailable,
  WEBGL_UNAVAILABLE,
} from "@/lib/webgl"

type Props = Omit<CanvasProps, "gl"> & {
  gl?: WebGLRendererParameters
  onUnavailable?: () => void
}

export default function SafeCanvas({
  gl,
  onUnavailable,
  onCreated,
  ...props
}: Props) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const unavailable = () => {
      setReady(false)
      onUnavailable?.()
    }
    window.addEventListener(WEBGL_UNAVAILABLE, unavailable)
    if (canUseWebGL()) setReady(true)
    else {
      unavailable()
      markWebGLUnavailable()
    }
    return () => window.removeEventListener(WEBGL_UNAVAILABLE, unavailable)
  }, [onUnavailable])

  const createRenderer = useCallback(
    async (defaults: WebGLRendererParameters) => {
      try {
        const canvas = defaults.canvas as HTMLCanvasElement
        const parameters = { ...defaults, ...gl, canvas }
        const context = canvas.getContext(
          "webgl2",
          parameters
        ) as WebGL2RenderingContext | null
        if (!context || context.isContextLost())
          throw new Error("WebGL unavailable")
        return new WebGLRenderer({ ...parameters, context })
      } catch {
        // R3F configures its renderer asynchronously. Resolve neither an invalid
        // renderer nor a rejected promise: unmount this canvas via the fallback.
        queueMicrotask(markWebGLUnavailable)
        return new Promise<WebGLRenderer>(() => {})
      }
    },
    [gl]
  )

  if (!ready) return null
  return (
    <Canvas
      {...props}
      gl={createRenderer}
      fallback={null}
      onCreated={(state) => {
        state.gl.domElement.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault()
            markWebGLUnavailable()
          },
          { once: true }
        )
        onCreated?.(state)
      }}
    />
  )
}
