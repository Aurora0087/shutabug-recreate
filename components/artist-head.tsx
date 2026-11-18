"use client"
import SafeCanvas from "./safe-canvas"
import { useFrame, useLoader, useThree } from "@react-three/fiber"
import { Suspense, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js"
function Head() {
  const gltf = useLoader(GLTFLoader, "/models/about-head.glb", (loader) =>
    loader.setMeshoptDecoder(MeshoptDecoder)
  )
  const { viewport, pointer } = useThree()
  const group = useRef<THREE.Group>(null)
  const model = useMemo(() => {
    const scene = gltf.scene.clone(true)
    const box = new THREE.Box3().setFromObject(scene),
      height = box.max.y - box.min.y,
      center = box.getCenter(new THREE.Vector3())
    scene.position.sub(center)
    const outer = new THREE.Group()
    outer.add(scene)
    outer.scale.setScalar(1 / height)
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = new THREE.ShaderMaterial({
          vertexShader: `varying vec3 vNormal;varying vec3 vEye;void main(){vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vEye=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
          fragmentShader: `varying vec3 vNormal;varying vec3 vEye;void main(){vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;float light=smoothstep(-.5,.95,dot(n,normalize(vec3(.78,.4,.48))));float rim=pow(1.-max(dot(n,vEye),0.),3.)*.06;vec3 colour=mix(vec3(.239),vec3(.847),clamp(light+rim,0.,1.));gl_FragColor=vec4(colour,1.);}`,
        })
      }
      if (o instanceof THREE.LineSegments) {
        o.material = new THREE.LineBasicMaterial({
          color: "#171715",
          transparent: true,
          opacity: 0.95,
        })
      }
    })
    return outer
  }, [gltf])
  useEffect(
    () => () => {
      model.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          if (!Array.isArray(o.material)) o.material.dispose()
        }
      })
    },
    [model]
  )
  useFrame((_, dt) => {
    if (!group.current) return
    const scroll = window.scrollY / window.innerHeight
    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y,
      -0.31 + pointer.x * 0.16 + scroll * 0.5,
      3,
      dt
    )
    group.current.rotation.x = THREE.MathUtils.damp(
      group.current.rotation.x,
      pointer.y * 0.035,
      3,
      dt
    )
  })
  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[3, 2, 3]} intensity={3} />
      <group
        ref={group}
        scale={viewport.height * 0.83}
        position={[0, -viewport.height * 0.035, 0]}
      >
        <primitive object={model} />
      </group>
    </>
  )
}
export default function ArtistHead() {
  return (
    <div className="artist-head-canvas">
      <SafeCanvas
        orthographic
        camera={{ position: [0, 0, 4], zoom: 100, near: 0.01, far: 10 }}
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true }}
      >
        <Suspense fallback={null}>
          <Head />
        </Suspense>
      </SafeCanvas>
    </div>
  )
}
