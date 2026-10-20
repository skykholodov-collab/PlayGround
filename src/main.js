import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import './style.css'
import { BODIES, PLANETS } from './data.js'
import { createSolarSystem } from './scene.js'

const stage = document.querySelector('#stage')
const panel = document.querySelector('#panel')
const panelWelcome = document.querySelector('#panel-welcome')
const panelInfo = document.querySelector('#panel-info')
const rail = document.querySelector('#rail')
const loader = document.querySelector('#loader')
const toast = document.querySelector('#toast')
const hint = document.querySelector('#hint')
const speedInput = document.querySelector('#speed')
const speedOut = document.querySelector('#speed-out')
const pauseButton = document.querySelector('#pause')
const orbitsButton = document.querySelector('#orbits')
const labelsButton = document.querySelector('#labels')
const resetButton = document.querySelector('#reset')
const tourButton = document.querySelector('#tour')
const tourLabel = tourButton.querySelector('span')

const isCompact = () => window.innerWidth <= 900
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.18
stage.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 2400)
camera.position.copy(overviewPosition())

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.055
controls.rotateSpeed = 0.55
controls.zoomSpeed = 0.8
controls.enablePan = false
controls.minDistance = 3
controls.maxDistance = 700
controls.autoRotate = !reduceMotion
controls.autoRotateSpeed = 0.3
controls.target.set(0, 0, 0)
controls.update()

const system = createSolarSystem(scene)

const labelsLayer = document.createElement('div')
labelsLayer.className = 'labels'
document.body.appendChild(labelsLayer)

for (const entry of system.entries) {
  const label = document.createElement('button')
  label.type = 'button'
  label.className = 'label'
  label.style.setProperty('--label-color', entry.data.accent)
  label.innerHTML = `<span class="dot"></span>${entry.data.name}`
  label.setAttribute('aria-label', `Inspect ${entry.data.name}`)
  label.addEventListener('click', (event) => {
    event.stopPropagation()
    selectEntry(entry)
  })
  labelsLayer.appendChild(label)
  entry.label = label
}

for (const body of BODIES) {
  const chip = document.createElement('button')
  chip.type = 'button'
  chip.className = 'chip'
  chip.style.setProperty('--chip-color', body.accent)
  chip.innerHTML = `<span class="dot"></span>${body.name}`
  chip.setAttribute('aria-label', `Select ${body.name}`)
  chip.addEventListener('click', () => {
    const entry = system.entries.find((candidate) => candidate.data.id === body.id)
    if (entry) selectEntry(entry)
  })
  rail.appendChild(chip)
  body.chip = chip
}

const state = {
  selected: null,
  tween: null,
  paused: false,
  speed: 1,
  orbits: true,
  labels: true,
  simTime: 0,
  touring: false,
  tourIndex: 0,
  tourTimer: null,
  focusShift: new THREE.Vector3(),
}

let lastFrame = performance.now()
const tmpVec = new THREE.Vector3()
const tmpVec2 = new THREE.Vector3()
const tmpVec3 = new THREE.Vector3()
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const pickables = system.entries.map((entry) => entry.mesh)

function overviewPosition() {
  if (window.innerWidth <= 900) {
    return new THREE.Vector3(0, 148, 252)
  }
  const aspect = window.innerWidth / window.innerHeight
  if (aspect < 1.25) return new THREE.Vector3(0, 98, 205)
  return new THREE.Vector3(0, 78, 168)
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function startTween(toPos, toTarget, duration = 1.05) {
  state.tween = {
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: toPos.clone(),
    toTarget: toTarget.clone(),
    elapsed: 0,
    duration,
  }
}

function focusOffset(entry, position) {
  if (entry.isSun) {
    return new THREE.Vector3(0.75, 0.5, 1).normalize()
  }
  const outward = position.clone().normalize()
  const sunward = outward.clone().multiplyScalar(-1)
  const tangent = new THREE.Vector3().crossVectors(outward, new THREE.Vector3(0, 1, 0)).normalize()
  return sunward
    .multiplyScalar(0.5)
    .addScaledVector(tangent, 0.9)
    .addScaledVector(new THREE.Vector3(0, 1, 0), 0.5)
    .normalize()
}

function focusDistance(entry) {
  const base = entry.isSun ? 96 : entry.radius * 9 + 6.5
  return isCompact() ? base * 1.24 : base
}

function selectEntry(entry, options = {}) {
  const { instant = false, keepTour = false } = options
  if (!keepTour) stopTour()

  state.selected = entry
  panel.classList.add('has-selection')
  panelWelcome.hidden = true
  panelInfo.hidden = false
  renderInfo(entry)

  for (const body of BODIES) body.chip.classList.toggle('is-active', body.id === entry.data.id)
  const activeChip = entry.data.chip
  if (activeChip) activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  for (const candidate of system.entries) {
    candidate.label.classList.toggle('is-active', candidate === entry)
  }

  for (const planet of system.planets) {
    const line = planet.orbitLine.material
    const active = planet === entry
    line.color.set(active ? entry.data.accent : 0x8fb6ff)
    line.opacity = active ? 0.55 : 0.16
  }

  system.selection.material.color.set(entry.data.accent)
  system.selection.visible = true
  system.selection.material.opacity = 0.75

  const position = entry.holder.getWorldPosition(tmpVec)
  const distance = focusDistance(entry)
  const destination = position.clone().addScaledVector(focusOffset(entry, position), distance)
  const verticalShift = isCompact()
    ? distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.41
    : 0
  const targetPoint = position.clone().add(new THREE.Vector3(0, -verticalShift, 0))
  state.focusShift.copy(targetPoint).sub(position)

  controls.autoRotate = false
  controls.enablePan = false
  controls.minDistance = entry.isSun ? 10 : Math.max(entry.radius * 2.4, 2.6)
  controls.maxDistance = entry.isSun ? 320 : Math.max(entry.radius * 26, 48)

  if (instant) {
    camera.position.copy(destination)
    controls.target.copy(targetPoint)
    state.tween = null
  } else {
    startTween(destination, targetPoint, 1.05)
  }

  hideHint()
}

function renderInfo(entry) {
  const body = entry.data
  const distance = body.au ? `${body.au} AU` : '—'
  panelInfo.innerHTML = `
    <div class="info-head">
      <span class="dot" style="background:${body.accent};color:${body.accent}"></span>
      <p class="eyebrow">${body.type}</p>
    </div>
    <h2>${body.name}</h2>
    <p class="tagline" style="color:${body.accent}">${body.tagline}</p>
    <p class="lede">${body.description}</p>
    <div class="stat-grid">
      <div class="stat"><span>Distance</span><strong>${distance}</strong></div>
      <div class="stat"><span>Diameter</span><strong>${body.diameter}</strong></div>
      <div class="stat"><span>Day</span><strong>${body.day}</strong></div>
      <div class="stat"><span>Year</span><strong>${body.year}</strong></div>
      <div class="stat"><span>Moons</span><strong>${body.moons}</strong></div>
      <div class="stat"><span>Temperature</span><strong>${body.temp}</strong></div>
    </div>
    <button class="back-btn" type="button" data-back>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      System overview
    </button>
  `
}

function resetView(options = {}) {
  const { instant = false, keepPanel = false } = options
  state.selected = null
  stopTour()
  if (!keepPanel) {
    panel.classList.remove('has-selection')
    panelWelcome.hidden = false
    panelInfo.hidden = true
    panelInfo.innerHTML = ''
  }

  for (const body of BODIES) body.chip.classList.remove('is-active')
  for (const entry of system.entries) entry.label.classList.remove('is-active')
  for (const planet of system.planets) {
    planet.orbitLine.material.color.set(0x8fb6ff)
    planet.orbitLine.material.opacity = 0.16
  }
  system.selection.visible = false
  state.focusShift.set(0, 0, 0)

  controls.autoRotate = !reduceMotion
  controls.enablePan = false
  controls.minDistance = 3
  controls.maxDistance = 700

  const destination = overviewPosition()
  if (instant) {
    camera.position.copy(destination)
    controls.target.set(0, 0, 0)
    state.tween = null
  } else {
    startTween(destination, new THREE.Vector3(0, 0, 0), 1.15)
  }
}

function hideHint() {
  hint.classList.add('is-hidden')
}

let toastTimer = 0
function showToast(message) {
  toast.textContent = message
  toast.classList.add('is-visible')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200)
}

function stopTour() {
  if (state.tourTimer) {
    window.clearInterval(state.tourTimer)
    state.tourTimer = null
  }
  state.touring = false
  tourButton.classList.remove('is-active')
  tourButton.setAttribute('aria-pressed', 'false')
  tourLabel.textContent = 'Guided tour'
}

function startTour() {
  stopTour()
  state.touring = true
  state.tourIndex = 0
  tourButton.classList.add('is-active')
  tourButton.setAttribute('aria-pressed', 'true')
  tourLabel.textContent = 'Stop tour'
  selectEntry(system.entries[0], { keepTour: true })
  showToast('Guided tour started')
  state.tourTimer = window.setInterval(() => {
    state.tourIndex = (state.tourIndex + 1) % system.entries.length
    selectEntry(system.entries[state.tourIndex], { keepTour: true })
  }, 6800)
}

function toggleTour() {
  if (state.touring) {
    stopTour()
    showToast('Tour stopped')
  } else {
    startTour()
  }
}

function setPaused(paused) {
  state.paused = paused
  pauseButton.classList.toggle('is-active', paused)
  pauseButton.setAttribute('aria-pressed', String(paused))
  pauseButton.title = paused ? 'Resume orbits' : 'Pause orbits'
  pauseButton.setAttribute('aria-label', paused ? 'Resume orbits' : 'Pause orbits')
  pauseButton.innerHTML = paused
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="5" width="3.4" height="14" rx="1.2" /><rect x="13.6" y="5" width="3.4" height="14" rx="1.2" /></svg>'
}

function pickEntry(event) {
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(pickables, false)
  if (hits.length > 0) {
    const entry = hits[0].object.userData.entry
    if (entry) selectEntry(entry)
  }
}

let hoverPending = false
let lastPointer = { x: 0, y: 0 }
let pointerDown = null

renderer.domElement.addEventListener('pointermove', (event) => {
  lastPointer = { x: event.clientX, y: event.clientY }
  if (hoverPending || event.pointerType === 'touch') return
  hoverPending = true
  requestAnimationFrame(() => {
    hoverPending = false
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((lastPointer.x - rect.left) / rect.width) * 2 - 1
    pointer.y = -((lastPointer.y - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(pickables, false)
    renderer.domElement.classList.toggle('is-hovering', hits.length > 0)
  })
})

renderer.domElement.addEventListener('pointerleave', () => {
  renderer.domElement.classList.remove('is-hovering')
})

renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerDown = { x: event.clientX, y: event.clientY }
  hideHint()
})

renderer.domElement.addEventListener('pointerup', (event) => {
  if (!pointerDown) return
  const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y)
  pointerDown = null
  if (distance < 7) pickEntry(event)
})

speedInput.addEventListener('input', () => {
  state.speed = Number(speedInput.value)
  speedOut.textContent = `${state.speed.toFixed(1)}×`
})

pauseButton.addEventListener('click', () => setPaused(!state.paused))

orbitsButton.addEventListener('click', () => {
  state.orbits = !state.orbits
  orbitsButton.classList.toggle('is-active', state.orbits)
  orbitsButton.setAttribute('aria-pressed', String(state.orbits))
  for (const planet of system.planets) {
    planet.orbitLine.visible = state.orbits
  }
  showToast(state.orbits ? 'Orbit lines on' : 'Orbit lines off')
})

labelsButton.addEventListener('click', () => {
  state.labels = !state.labels
  labelsButton.classList.toggle('is-active', state.labels)
  labelsButton.setAttribute('aria-pressed', String(state.labels))
  if (!state.labels) {
    for (const entry of system.entries) entry.label.classList.add('is-hidden')
  }
})

resetButton.addEventListener('click', () => resetView())
tourButton.addEventListener('click', toggleTour)

panelInfo.addEventListener('click', (event) => {
  if (event.target.closest('[data-back]')) resetView()
})

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return
  if (event.code === 'Space') {
    event.preventDefault()
    setPaused(!state.paused)
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    resetView()
  } else if (event.key.toLowerCase() === 't') {
    toggleTour()
  }
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
  renderer.setSize(window.innerWidth, window.innerHeight)
  if (!state.selected) {
    camera.position.copy(overviewPosition())
    controls.target.set(0, 0, 0)
  } else {
    const position = state.selected.holder.getWorldPosition(tmpVec2)
    const distance = camera.position.distanceTo(position)
    const shift = isCompact()
      ? distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.41
      : 0
    state.focusShift.set(0, -shift, 0)
  }
})

const clockTime = { value: 0 }

function updateLabels() {
  if (!state.labels) return
  const width = window.innerWidth
  const height = window.innerHeight
  for (const entry of system.entries) {
    const position = entry.holder.getWorldPosition(tmpVec2)
    position.y += entry.radius * 1.35 + 0.9
    position.project(camera)
    const onScreen =
      position.z < 1 && Math.abs(position.x) < 1.1 && Math.abs(position.y) < 1.1
    entry.label.classList.toggle('is-hidden', !onScreen)
    if (onScreen) {
      const x = (position.x * 0.5 + 0.5) * width
      const y = (-position.y * 0.5 + 0.5) * height
      entry.label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`
    }
  }
}

function followSelected() {
  if (!state.selected) return
  const position = state.selected.holder.getWorldPosition(tmpVec2)
  const target = tmpVec3.copy(position).add(state.focusShift)
  tmpVec.copy(target).sub(controls.target)
  camera.position.add(tmpVec)
  controls.target.copy(target)
}

function animate() {
  requestAnimationFrame(animate)
  const now = performance.now()
  const delta = Math.min((now - lastFrame) / 1000, 0.05)
  lastFrame = now
  clockTime.value += delta

  if (!state.paused) {
    state.simTime += delta * state.speed
  }
  const time = state.simTime

  for (const planet of system.planets) {
    planet.pivot.rotation.y = planet.data.angle + time * planet.speed
    planet.mesh.rotation.y = time * (planet.spin * 0.75 + 0.05)
    if (planet.clouds) planet.clouds.rotation.y = time * (planet.spin * 0.6 + 0.03)
    if (planet.moonPivot) planet.moonPivot.rotation.y = 1.2 + time * 0.45
  }
  system.sun.mesh.rotation.y = time * 0.012
  system.belt.rotation.y = time * 0.02
  system.belt.visible = camera.position.length() > 90
  system.stars.rotation.y = clockTime.value * 0.0035

  const glowPulse = 1 + Math.sin(clockTime.value * 1.4) * 0.035
  const glowFade = THREE.MathUtils.smoothstep(camera.position.length(), 38, 120)
  system.sun.innerGlow.scale.setScalar(34 * glowPulse)
  system.sun.innerGlow.material.opacity = 0.85 * glowFade
  system.sun.outerGlow.material.opacity = (0.2 + Math.sin(clockTime.value * 1.1) * 0.035) * glowFade

  if (state.selected) {
    state.selected.holder.getWorldPosition(tmpVec2)
    system.selection.position.copy(tmpVec2)
    const ringBoost = state.selected.data.ring ? 1.95 : 1
    const scale = Math.max(state.selected.radius * 2.7 * ringBoost, 2.2)
    system.selection.scale.setScalar(scale)
    system.selection.material.opacity =
      0.45 + Math.sin(clockTime.value * 2.1) * 0.16 + (state.selected.isSun ? 0.1 : 0)
  }

  if (state.tween) {
    const tween = state.tween
    tween.elapsed += delta
    const progress = Math.min(tween.elapsed / tween.duration, 1)
    const eased = easeInOutCubic(progress)
    camera.position.lerpVectors(tween.fromPos, tween.toPos, eased)
    controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased)
    if (progress >= 1) state.tween = null
  } else if (state.selected) {
    followSelected()
  }

  controls.enabled = !state.tween
  if (!state.tween) controls.update()
  else camera.lookAt(controls.target)

  updateLabels()
  renderer.render(scene, camera)
}

function finishLoading() {
  loader.classList.add('is-done')
  document.body.dataset.ready = 'true'
  window.__ORBIT_READY__ = true
  if (isCompact()) {
    const earth = system.entries.find((entry) => entry.data.id === 'earth')
    if (earth) selectEntry(earth, { instant: true })
  }
  window.setTimeout(() => hideHint(), 7000)
}

renderer.compile(scene, camera)
renderer.render(scene, camera)
requestAnimationFrame(() => {
  animate()
  setTimeout(finishLoading, 260)
})
