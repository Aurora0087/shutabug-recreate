"use client"
import { Camera, Object3D, Vector3 } from "three"
import type { ArtworkSource } from "./artwork-transition"

export function projectedArtwork(
  mesh: Object3D,
  camera: Camera,
  canvas: HTMLCanvasElement
): ArtworkSource["corners"] | null {
  const rect = canvas.getBoundingClientRect()
  mesh.updateWorldMatrix(true, false)
  const points = [
    [-0.5, 0.5],
    [0.5, 0.5],
    [0.5, -0.5],
    [-0.5, -0.5],
  ].map(([x, y]) =>
    new Vector3(x, y, 0).applyMatrix4(mesh.matrixWorld).project(camera)
  )
  if (
    points.some(
      (p) =>
        p.z > 1 || p.z < -1 || !Number.isFinite(p.x) || !Number.isFinite(p.y)
    )
  )
    return null
  return points.map((p) => ({
    x: rect.left + ((p.x + 1) * rect.width) / 2,
    y: rect.top + ((1 - p.y) * rect.height) / 2,
  })) as ArtworkSource["corners"]
}
