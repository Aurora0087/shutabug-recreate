import { readFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import catalog from "@/lib/catalog.json"
import { printDimensions, printFrame, printSize } from "@/lib/ar-options"
import { encodePrintGLB } from "@/lib/ar-glb"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams
  const product = catalog.find((p) => p.key === query.get("art"))
  if (!product) return new Response("Artwork not found", { status: 404 })
  const size = printSize(query.get("size")),
    frame = printFrame(query.get("frame"))
  const dimensions = printDimensions(size, frame, product.ratio)
  try {
    // Only catalog-owned local files can be read; no caller-provided paths/URLs.
    const image = await readFile(
      path.join(process.cwd(), "public", product.src.slice(1))
    )
    const longest = 1500
    const width = Math.round(
      longest * Math.min(1, dimensions.width / dimensions.height)
    )
    const height = Math.round(
      longest * Math.min(1, dimensions.height / dimensions.width)
    )
    const png = await sharp(image)
      .resize(width, height, { fit: "cover", withoutEnlargement: true })
      .png()
      .toBuffer()
    const glb = encodePrintGLB({
      png,
      size,
      frame,
      ratio: product.ratio,
      title: product.title,
    })
    return new Response(glb, {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="${product.key}-${size}.glb"`,
      },
    })
  } catch (error) {
    console.error("Could not build wall preview model", error)
    return new Response("Could not prepare this artwork. Please retry.", {
      status: 500,
    })
  }
}
