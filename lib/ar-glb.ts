import * as THREE from "three"
import { createPrintPiece } from "./ar-piece"
import type { PrintSize, PrintFrame } from "./ar-options"

// Pack a standard GLB with an embedded PNG. Unlike a browser blob URL, this
// public model asset can also be fetched by Android's native Scene Viewer.
export function encodePrintGLB({
  png,
  size,
  frame,
  ratio,
  title,
}: {
  png: Uint8Array
  size: PrintSize
  frame: PrintFrame
  ratio: number
  title: string
}) {
  const { piece, face, dispose } = createPrintPiece(size, frame, ratio)
  const chunks: Buffer[] = [],
    bufferViews: Record<string, number>[] = [],
    accessors: Record<string, unknown>[] = []
  const meshes: Record<string, unknown>[] = [],
    nodes: Record<string, unknown>[] = [],
    materials: Record<string, unknown>[] = []
  let offset = 0
  const view = (bytes: Uint8Array, target?: number) => {
    const data = Buffer.from(bytes),
      padding = (4 - (data.length % 4)) % 4
    const index = bufferViews.length
    bufferViews.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: data.length,
      ...(target ? { target } : {}),
    })
    chunks.push(data, Buffer.alloc(padding))
    offset += data.length + padding
    return index
  }
  const attribute = (array: Float32Array, itemSize: number, minMax = false) => {
    const bufferView = view(
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength),
      34962
    )
    const accessor: Record<string, unknown> = {
      bufferView,
      componentType: 5126,
      count: array.length / itemSize,
      type: itemSize === 3 ? "VEC3" : "VEC2",
    }
    if (minMax) {
      const min = Array(itemSize).fill(Infinity),
        max = Array(itemSize).fill(-Infinity)
      for (let i = 0; i < array.length; i++) {
        const k = i % itemSize
        min[k] = Math.min(min[k], array[i])
        max[k] = Math.max(max[k], array[i])
      }
      accessor.min = min
      accessor.max = max
    }
    accessors.push(accessor)
    return accessors.length - 1
  }
  const imageView = view(png)
  try {
    piece.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone()
      const attrs: Record<string, number> = {}
      for (const [name, semantic] of [
        ["position", "POSITION"],
        ["normal", "NORMAL"],
        ["uv", "TEXCOORD_0"],
      ]) {
        const attr = geometry.getAttribute(name)
        if (!attr) continue
        const array = new Float32Array(attr.count * attr.itemSize)
        for (let i = 0; i < attr.count; i++)
          for (let c = 0; c < attr.itemSize; c++)
            array[i * attr.itemSize + c] =
              name === "uv" && c === 1
                ? 1 - attr.getComponent(i, c)
                : attr.getComponent(i, c)
        attrs[semantic] = attribute(array, attr.itemSize, name === "position")
      }
      const mat = object.material as THREE.MeshStandardMaterial
      const texture = object === face
      materials.push({
        name: texture ? "Printed artwork" : "Paper and frame",
        pbrMetallicRoughness: {
          baseColorFactor: [mat.color.r, mat.color.g, mat.color.b, 1],
          metallicFactor: 0,
          roughnessFactor: mat.roughness,
          ...(texture ? { baseColorTexture: { index: 0 } } : {}),
        },
      })
      meshes.push({
        primitives: [{ attributes: attrs, material: materials.length - 1 }],
      })
      nodes.push({
        name: texture ? title : "Print backing",
        mesh: meshes.length - 1,
        matrix: object.matrixWorld.toArray(),
      })
      geometry.dispose()
    })
    const gltf = {
      asset: { version: "2.0", generator: "Shutabug wall preview" },
      scene: 0,
      scenes: [{ nodes: nodes.map((_, i) => i) }],
      nodes,
      meshes,
      materials,
      accessors,
      bufferViews,
      buffers: [{ byteLength: offset }],
      images: [{ bufferView: imageView, mimeType: "image/png" }],
      textures: [{ source: 0, sampler: 0 }],
      samplers: [
        { magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 },
      ],
    }
    const json = Buffer.from(JSON.stringify(gltf)),
      jsonSize = Math.ceil(json.length / 4) * 4
    const binary = Buffer.concat(chunks),
      total = 12 + 8 + jsonSize + 8 + binary.length
    const result = Buffer.alloc(total)
    result.writeUInt32LE(0x46546c67, 0)
    result.writeUInt32LE(2, 4)
    result.writeUInt32LE(total, 8)
    result.writeUInt32LE(jsonSize, 12)
    result.writeUInt32LE(0x4e4f534a, 16)
    result.fill(0x20, 20, 20 + jsonSize)
    json.copy(result, 20)
    const at = 20 + jsonSize
    result.writeUInt32LE(binary.length, at)
    result.writeUInt32LE(0x004e4942, at + 4)
    binary.copy(result, at + 8)
    return new Uint8Array(result)
  } finally {
    dispose()
  }
}
