import * as THREE from 'three'
import { SUN, PLANETS, angularSpeed } from './data.js'
import {
  makeCloudTexture,
  makeGlowTexture,
  makeMoonTexture,
  makePlanetTexture,
  makeRingTexture,
  makeSelectionTexture,
} from './textures.js'

const ORBIT_SEGMENTS = 256

function buildOrbitLine(radius, color) {
  const points = []
  for (let i = 0; i <= ORBIT_SEGMENTS; i += 1) {
    const angle = (i / ORBIT_SEGMENTS) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius))
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  })
  return new THREE.LineLoop(geometry, material)
}

function buildStars(scene) {
  const count = 7200
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const random = (() => {
    let seed = 991
    return () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
  })()
  const palette = [
    new THREE.Color('#ffffff'),
    new THREE.Color('#cfe2ff'),
    new THREE.Color('#ffe9c9'),
    new THREE.Color('#9fb8ff'),
  ]

  for (let i = 0; i < count; i += 1) {
    const radius = 240 + random() * 560
    const theta = random() * Math.PI * 2
    const phi = Math.acos(2 * random() - 1)
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = radius * Math.cos(phi)
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
    const color = palette[Math.floor(random() * palette.length)]
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const material = new THREE.PointsMaterial({
    size: 1.45,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  })
  const points = new THREE.Points(geometry, material)
  scene.add(points)
  return points
}

function buildAsteroidBelt() {
  const count = 720
  const geometry = new THREE.DodecahedronGeometry(1, 0)
  const material = new THREE.MeshStandardMaterial({
    color: 0x8d8377,
    roughness: 0.96,
    metalness: 0.05,
    flatShading: true,
  })
  const mesh = new THREE.InstancedMesh(geometry, material, count)
  const dummy = new THREE.Object3D()
  let seed = 5150
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  for (let i = 0; i < count; i += 1) {
    const radius = 32.8 + random() * 5.2
    const angle = random() * Math.PI * 2
    const scale = 0.012 + random() * 0.038
    dummy.position.set(
      Math.cos(angle) * radius,
      (random() - 0.5) * 1.6,
      Math.sin(angle) * radius,
    )
    dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI)
    dummy.scale.set(scale, scale * (0.6 + random() * 0.7), scale * (0.6 + random() * 0.7))
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.frustumCulled = false
  return mesh
}

function buildSun(root) {
  const holder = new THREE.Group()
  root.add(holder)

  const geometry = new THREE.SphereGeometry(SUN.radius, 64, 64)
  const material = new THREE.MeshBasicMaterial({ map: makePlanetTexture(SUN, 1024) })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.userData.bodyId = SUN.id
  holder.add(mesh)

  const glowTexture = makeGlowTexture()
  const innerGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffc46b,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  innerGlow.scale.setScalar(44)
  holder.add(innerGlow)

  const outerGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xff8a3d,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  outerGlow.scale.setScalar(96)
  holder.add(outerGlow)

  const entry = {
    data: SUN,
    holder,
    mesh,
    radius: SUN.radius,
    orbitLine: null,
    index: -1,
    isSun: true,
  }
  mesh.userData.entry = entry

  return { entry, holder, mesh, innerGlow, outerGlow }
}

function buildPlanet(root, planet) {
  const orbitGroup = new THREE.Group()
  orbitGroup.rotation.x = planet.inclination || 0
  root.add(orbitGroup)

  const pivot = new THREE.Group()
  pivot.rotation.y = planet.angle || 0
  orbitGroup.add(pivot)

  const holder = new THREE.Group()
  holder.position.x = planet.orbit
  pivot.add(holder)

  const geometry = new THREE.SphereGeometry(planet.radius, 48, 48)
  const texture = makePlanetTexture(planet, 1024)
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: planet.style === 'gas' || planet.style === 'ice' ? 0.72 : 0.9,
    metalness: 0.02,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.z = planet.axialTilt || 0
  mesh.userData.bodyId = planet.id
  holder.add(mesh)

  let rim = null
  if (!planet.clouds) {
    rim = new THREE.Mesh(
      new THREE.SphereGeometry(planet.radius * 1.045, 32, 32),
      new THREE.MeshBasicMaterial({
        color: planet.accent,
        transparent: true,
        opacity: 0.055,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    holder.add(rim)
  }

  let clouds = null
  if (planet.clouds) {
    const cloudGeometry = new THREE.SphereGeometry(planet.radius * 1.012, 48, 48)
    const cloudMaterial = new THREE.MeshStandardMaterial({
      map: makeCloudTexture(),
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
      roughness: 1,
    })
    clouds = new THREE.Mesh(cloudGeometry, cloudMaterial)
    clouds.rotation.z = planet.axialTilt || 0
    holder.add(clouds)

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(planet.radius * 1.09, 48, 48),
      new THREE.MeshBasicMaterial({
        color: 0x59a8ff,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    holder.add(atmosphere)
  }

  let ring = null
  if (planet.ring) {
    const inner = planet.radius * 1.35
    const outer = planet.radius * 2.35
    const ringGeometry = new THREE.RingGeometry(inner, outer, 160, 1)
    const position = ringGeometry.attributes.position
    const uv = ringGeometry.attributes.uv
    const vertex = new THREE.Vector3()
    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i)
      const radius = vertex.length()
      uv.setXY(i, (radius - inner) / (outer - inner), 0.5)
    }
    uv.needsUpdate = true
    const ringMaterial = new THREE.MeshBasicMaterial({
      map: makeRingTexture(),
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    ring = new THREE.Mesh(ringGeometry, ringMaterial)
    ring.rotation.x = -Math.PI / 2
    mesh.add(ring)
  }

  let moonPivot = null
  let moon = null
  if (planet.moon) {
    moonPivot = new THREE.Group()
    moonPivot.rotation.y = 1.2
    holder.add(moonPivot)
    const moonRadius = planet.radius * 0.27
    moon = new THREE.Mesh(
      new THREE.SphereGeometry(moonRadius, 24, 24),
      new THREE.MeshStandardMaterial({
        map: makeMoonTexture(),
        roughness: 1,
        metalness: 0,
      }),
    )
    moon.position.x = planet.radius * 3.6
    moonPivot.add(moon)
  }

  const orbitLine = buildOrbitLine(planet.orbit, 0x8fb6ff)
  orbitGroup.add(orbitLine)

  const entry = {
    data: planet,
    holder,
    mesh,
    orbitGroup,
    pivot,
    orbitLine,
    radius: planet.radius,
    moonPivot,
    clouds,
    ring,
    rim,
    index: planet.id,
    speed: angularSpeed(planet),
    spin: planet.spin,
  }
  mesh.userData.entry = entry

  return entry
}

export function createSolarSystem(scene) {
  const root = new THREE.Group()
  scene.add(root)

  const stars = buildStars(scene)

  const ambient = new THREE.AmbientLight(0x9db4d8, 0.55)
  scene.add(ambient)
  const sunLight = new THREE.PointLight(0xfff0cf, 2.6, 0, 0)
  scene.add(sunLight)
  const fill = new THREE.DirectionalLight(0x6b8cff, 0.55)
  fill.position.set(-60, -40, -80)
  scene.add(fill)

  const sun = buildSun(root)
  const entries = [sun.entry]
  const planets = []
  for (const planet of PLANETS) {
    const entry = buildPlanet(root, planet)
    planets.push(entry)
    entries.push(entry)
  }

  const belt = buildAsteroidBelt()
  root.add(belt)

  const selection = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeSelectionTexture(),
      color: 0x6ec6ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  selection.visible = false
  root.add(selection)

  return {
    root,
    stars,
    sun,
    planets,
    entries,
    belt,
    selection,
    sunLight,
    ambient,
  }
}
