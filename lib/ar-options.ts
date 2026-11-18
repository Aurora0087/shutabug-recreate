export const PRINT_SIZES = {
  A3: { label: "11.7 × 16.5” (A3)", metres: [0.297, 0.42] },
  A2: { label: "16.5 × 23.4” (A2)", metres: [0.42, 0.594] },
  A1: { label: "23.4 × 33.1” (A1)", metres: [0.594, 0.841] },
  A0: { label: "33.1 × 46.8” (A0)", metres: [0.841, 1.189] },
} as const
export type PrintSize = keyof typeof PRINT_SIZES
export const PRINT_FRAMES = [
  "Unframed",
  "Classic frame",
  "Framed canvas",
] as const
export type PrintFrame = (typeof PRINT_FRAMES)[number]
export function printSize(value: string | null | undefined): PrintSize {
  const code = value?.toUpperCase().match(/\bA[0-3]\b/)?.[0]
  return code && code in PRINT_SIZES ? (code as PrintSize) : "A3"
}
export function printFrame(value: string | null | undefined): PrintFrame {
  const frame = value?.trim().toLowerCase().replaceAll("-", " ")
  return PRINT_FRAMES.find((v) => v.toLowerCase() === frame) || "Unframed"
}
export function printDimensions(
  size: PrintSize,
  frame: PrintFrame,
  ratio: number
) {
  const [short, long] = PRINT_SIZES[size].metres
  const width = ratio > 1 ? long : short,
    height = ratio > 1 ? short : long
  const border =
    frame === "Classic frame" ? 0.02 : frame === "Framed canvas" ? 0.008 : 0
  return {
    width,
    height,
    outerWidth: width + 2 * border,
    outerHeight: height + 2 * border,
  }
}
export function wallPreviewHref(href: string, size: string, frame: string) {
  return `${href}/ar?${new URLSearchParams({ frame: printFrame(frame), size: PRINT_SIZES[printSize(size)].label })}`
}
export function productReturnHref(
  href: string,
  size: PrintSize,
  frame: PrintFrame
) {
  return `${href}?${new URLSearchParams({ frame, size })}`
}
