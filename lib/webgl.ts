export const WEBGL_UNAVAILABLE = "shutabug:webgl-unavailable"
let available: boolean | undefined

export function markWebGLUnavailable() {
  available = false
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(WEBGL_UNAVAILABLE))
  }
}

export function canUseWebGL() {
  if (typeof document === "undefined") return false
  if (available !== undefined) return available
  try {
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("webgl2")
    available = !!context && !context.isContextLost()
    context?.getExtension("WEBGL_lose_context")?.loseContext()
  } catch {
    available = false
  }
  return available
}
