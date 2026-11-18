import * as THREE from "three"
import { printDimensions, type PrintFrame, type PrintSize } from "./ar-options"

// All geometry is in metres. AR viewers can therefore place the selected print
// at its physical size without guessing scale from the image resolution.
export function createPrintPiece(
  size: PrintSize,
  frame: PrintFrame,
  ratio: number
) {
  const dimensions = printDimensions(size, frame, ratio)
  const { width: w, height: h } = dimensions
  const piece = new THREE.Group()
  const materials: THREE.MeshStandardMaterial[] = []
  const material = (colour: string, roughness = 0.85) => {
    const value = new THREE.MeshStandardMaterial({
      color: colour,
      roughness,
      metalness: 0,
    })
    materials.push(value)
    return value
  }
  const box = (
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.MeshStandardMaterial
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      mat
    )
    mesh.position.set(x, y, z)
    piece.add(mesh)
    return mesh
  }
  const border = (
    width: number,
    height: number,
    thickness: number,
    depth: number,
    z: number
  ) => {
    const mat = material("#191917", 0.55)
    box(
      width + 2 * thickness,
      thickness,
      depth,
      0,
      height / 2 + thickness / 2,
      z,
      mat
    )
    box(
      width + 2 * thickness,
      thickness,
      depth,
      0,
      -height / 2 - thickness / 2,
      z,
      mat
    )
    box(thickness, height, depth, -width / 2 - thickness / 2, 0, z, mat)
    box(thickness, height, depth, width / 2 + thickness / 2, 0, z, mat)
  }
  let faceZ = 0.0034
  if (frame === "Classic frame") {
    box(w, h, 0.014, 0, 0, 0.007, material("#f4f2ec"))
    border(w, h, 0.02, 0.02, 0.01)
    faceZ = 0.0144
  } else if (frame === "Framed canvas") {
    box(w, h, 0.038, 0, 0, 0.019, material("#e5e0d6"))
    border(w + 0.004, h + 0.004, 0.006, 0.045, 0.0225)
    faceZ = 0.0384
  } else box(w, h, 0.003, 0, 0, 0.0015, material("#f4f2ec"))
  const ink = material("#ffffff", 0.9)
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ink)
  face.name = "Artwork"
  face.position.z = faceZ
  piece.add(face)
  piece.name = "Art print"
  piece.updateMatrixWorld(true)
  return {
    piece,
    face,
    dimensions,
    dispose() {
      piece.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose()
      })
      materials.forEach((m) => m.dispose())
    },
  }
}
