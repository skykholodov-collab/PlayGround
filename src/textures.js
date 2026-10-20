import * as THREE from 'three'

const TAU = Math.PI * 2

function canvas2d(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return { canvas, ctx: canvas.getContext('2d') }
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function ellipseWrapped(ctx, x, y, rx, ry, width, rotation = 0) {
  for (const offset of [-width, 0, width]) {
    ctx.beginPath()
    ctx.ellipse(x + offset, y, rx, ry, rotation, 0, TAU)
    ctx.fill()
  }
}

function verticalBase(ctx, width, height, body, random) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, body.texture.mid || body.texture.base)
  gradient.addColorStop(0.5, body.texture.base)
  gradient.addColorStop(1, body.texture.mid || body.texture.base)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const wash = mulberry32((body.seed || 1) * 97)
  ctx.globalAlpha = 0.1
  for (let i = 0; i < 26; i += 1) {
    const y = wash() * height
    ctx.fillStyle = wash() > 0.5 ? '#ffffff' : '#000000'
    ctx.fillRect(0, y, width, 2 + wash() * 18)
  }
  ctx.globalAlpha = 1
  void random
}

function drawBands(ctx, width, height, body, random, strength = 1) {
  const palette = body.texture.palette
  const count = 54
  for (let i = 0; i < count; i += 1) {
    const y = random() * height
    const amplitude = 1 + random() * 14
    const frequency = 0.6 + random() * 2.4
    const phase = random() * TAU
    const lineWidth = 2 + random() * 20
    ctx.beginPath()
    for (let x = 0; x <= width; x += 8) {
      const yy = y + Math.sin((x / width) * TAU * frequency + phase) * amplitude
      if (x === 0) ctx.moveTo(x, yy)
      else ctx.lineTo(x, yy)
    }
    ctx.strokeStyle = palette[Math.floor(random() * palette.length)]
    ctx.globalAlpha = (0.05 + random() * 0.14) * strength
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawRocky(ctx, width, height, body, random) {
  const palette = body.texture.palette
  for (let i = 0; i < 280; i += 1) {
    const x = random() * width
    const y = random() * height
    const radius = 8 + random() * 70
    ctx.fillStyle = palette[Math.floor(random() * palette.length)]
    ctx.globalAlpha = 0.05 + random() * 0.12
    ellipseWrapped(ctx, x, y, radius, radius * (0.4 + random() * 0.8), width, random() * TAU)
  }
  ctx.globalAlpha = 1

  for (let i = 0; i < 44; i += 1) {
    const x = random() * width
    const y = 30 + random() * (height - 60)
    const radius = 3 + random() * 20
    ctx.globalAlpha = 0.16 + random() * 0.2
    ctx.fillStyle = '#2b2723'
    ellipseWrapped(ctx, x, y, radius, radius * 0.85, width)
    ctx.globalAlpha = 0.12
    ctx.strokeStyle = '#e9e1d5'
    ctx.lineWidth = Math.max(1, radius * 0.12)
    for (const offset of [-width, 0, width]) {
      ctx.beginPath()
      ctx.ellipse(x + offset, y, radius * 0.86, radius * 0.7, 0, Math.PI * 1.05, Math.PI * 1.75)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

function drawIce(ctx, width, height, body, random) {
  drawBands(ctx, width, height, body, random, 0.55)
  const palette = body.texture.palette
  for (let i = 0; i < 16; i += 1) {
    const y = random() * height
    ctx.globalAlpha = 0.08 + random() * 0.1
    ctx.fillStyle = random() > 0.5 ? '#ffffff' : palette[0]
    ctx.fillRect(0, y, width, 1 + random() * 4)
  }
  ctx.globalAlpha = 1
}

function drawEarth(ctx, width, height, body, random) {
  const ocean = ctx.createLinearGradient(0, 0, 0, height)
  ocean.addColorStop(0, '#0d4a73')
  ocean.addColorStop(0.5, '#0a3a60')
  ocean.addColorStop(1, '#0d4a73')
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, width, height)

  const land = ['#3f7a4a', '#4d7f43', '#6f7d42', '#8a7a4f', '#547a4b', '#456f3f']
  const continents = [
    [0.18, 0.32, 1.0],
    [0.31, 0.62, 0.7],
    [0.5, 0.35, 1.15],
    [0.58, 0.66, 0.55],
    [0.72, 0.4, 0.85],
    [0.84, 0.68, 0.5],
    [0.06, 0.62, 0.4],
  ]

  for (const [cx, cy, scale] of continents) {
    const blobs = Math.floor(40 * scale) + 14
    let x = cx * width
    let y = cy * height
    for (let i = 0; i < blobs; i += 1) {
      const radius = (9 + random() * 24) * scale
      x += (random() - 0.5) * 34 * scale
      y += (random() - 0.5) * 24 * scale
      ctx.fillStyle = '#1d5f82'
      ctx.globalAlpha = 0.16
      ellipseWrapped(ctx, x, y, radius * 1.2, radius * (0.55 + random() * 0.6), width, random() * TAU)
      ctx.fillStyle = land[Math.floor(random() * land.length)]
      ctx.globalAlpha = 0.62 + random() * 0.3
      ellipseWrapped(ctx, x, y, radius, radius * (0.5 + random() * 0.55), width, random() * TAU)
      if (random() > 0.68) {
        ctx.fillStyle = '#b9a878'
        ctx.globalAlpha = 0.22
        ellipseWrapped(ctx, x, y, radius * 0.5, radius * 0.32, width)
      }
      if (random() > 0.82) {
        ctx.fillStyle = '#2c6339'
        ctx.globalAlpha = 0.28
        ellipseWrapped(ctx, x, y, radius * 0.55, radius * 0.35, width)
      }
    }
    x += (random() - 0.5) * 20
    y += (random() - 0.5) * 20
  }

  const cap = ctx.createLinearGradient(0, 0, 0, height * 0.13)
  cap.addColorStop(0, 'rgba(240,248,255,0.95)')
  cap.addColorStop(1, 'rgba(240,248,255,0)')
  ctx.fillStyle = cap
  ctx.globalAlpha = 1
  ctx.fillRect(0, 0, width, height * 0.13)

  const south = ctx.createLinearGradient(0, height, 0, height * 0.86)
  south.addColorStop(0, 'rgba(240,248,255,0.95)')
  south.addColorStop(1, 'rgba(240,248,255,0)')
  ctx.fillStyle = south
  ctx.fillRect(0, height * 0.86, width, height * 0.14)

  ctx.globalAlpha = 0.18
  for (let i = 0; i < 120; i += 1) {
    ctx.fillStyle = random() > 0.5 ? '#7fd0e8' : '#062a47'
    ellipseWrapped(ctx, random() * width, random() * height, 6 + random() * 40, 4 + random() * 20, width)
  }
  ctx.globalAlpha = 1
  void body
}

function finish(canvas, { wrap = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  if (wrap) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
  }
  texture.needsUpdate = true
  return texture
}

export function makePlanetTexture(body, size = 1024) {
  const width = size
  const height = Math.floor(size / 2)
  const { canvas, ctx } = canvas2d(width, height)
  const random = mulberry32((body.seed || 7) * 131)

  if (body.style === 'sun') {
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#ffb52e')
    gradient.addColorStop(0.5, '#ff9a12')
    gradient.addColorStop(1, '#ffb52e')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    for (let i = 0; i < 340; i += 1) {
      const palette = body.texture.palette
      ctx.fillStyle = palette[Math.floor(random() * palette.length)]
      ctx.globalAlpha = 0.06 + random() * 0.16
      ellipseWrapped(
        ctx,
        random() * width,
        random() * height,
        6 + random() * 44,
        5 + random() * 26,
        width,
        random() * TAU,
      )
    }
    ctx.globalAlpha = 0.18
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = '#fff3c4'
      ellipseWrapped(
        ctx,
        random() * width,
        random() * height,
        2 + random() * 8,
        1 + random() * 5,
        width,
      )
    }
    ctx.globalAlpha = 1
    return finish(canvas)
  }

  verticalBase(ctx, width, height, body, random)

  if (body.style === 'gas') {
    drawBands(ctx, width, height, body, random)
    if (body.id === 'jupiter') {
      const spotX = width * 0.66
      const spotY = height * 0.63
      const spot = ctx.createRadialGradient(spotX, spotY, 2, spotX, spotY, 62)
      spot.addColorStop(0, 'rgba(184,84,50,0.85)')
      spot.addColorStop(0.6, 'rgba(196,104,64,0.55)')
      spot.addColorStop(1, 'rgba(196,104,64,0)')
      ctx.fillStyle = spot
      ellipseWrapped(ctx, spotX, spotY, 66, 34, width)
    }
  } else if (body.style === 'ice') {
    drawIce(ctx, width, height, body, random)
  } else if (body.style === 'earth') {
    drawEarth(ctx, width, height, body, random)
  } else if (body.style === 'venus') {
    drawBands(ctx, width, height, body, random, 0.6)
    for (let i = 0; i < 120; i += 1) {
      ctx.strokeStyle = body.texture.palette[Math.floor(random() * 3)]
      ctx.globalAlpha = 0.06 + random() * 0.1
      ctx.lineWidth = 4 + random() * 18
      ctx.beginPath()
      for (let x = 0; x <= width; x += 10) {
        const y = random() * height + Math.sin((x / width) * TAU * 1.6) * 18
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  } else {
    drawRocky(ctx, width, height, body, random)
  }

  return finish(canvas)
}

export function makeCloudTexture() {
  const width = 1024
  const height = 512
  const { canvas, ctx } = canvas2d(width, height)
  const random = mulberry32(4242)

  for (let cluster = 0; cluster < 22; cluster += 1) {
    let x = random() * width
    let y = 30 + random() * (height - 60)
    const scale = 0.6 + random() * 1.1
    for (let i = 0; i < 30; i += 1) {
      const radius = (5 + random() * 26) * scale
      x += (random() - 0.5) * 30
      y += (random() - 0.5) * 14
      ctx.fillStyle = '#ffffff'
      ctx.globalAlpha = 0.03 + random() * 0.09
      ellipseWrapped(ctx, x, y, radius * 1.8, radius * 0.6, width, random() * 0.6 - 0.3)
    }
  }
  ctx.globalAlpha = 1
  return finish(canvas)
}

export function makeMoonTexture() {
  const width = 512
  const height = 256
  const { canvas, ctx } = canvas2d(width, height)
  const random = mulberry32(777)
  ctx.fillStyle = '#9a978f'
  ctx.fillRect(0, 0, width, height)
  for (let i = 0; i < 120; i += 1) {
    ctx.fillStyle = random() > 0.5 ? '#7d7a73' : '#b3b0a8'
    ctx.globalAlpha = 0.2 + random() * 0.35
    ellipseWrapped(ctx, random() * width, random() * height, 4 + random() * 34, 4 + random() * 30, width)
  }
  for (let i = 0; i < 70; i += 1) {
    const x = random() * width
    const y = random() * height
    const radius = 2 + random() * 12
    ctx.fillStyle = '#6b6862'
    ctx.globalAlpha = 0.35
    ellipseWrapped(ctx, x, y, radius, radius * 0.9, width)
    ctx.fillStyle = '#d6d3cb'
    ctx.globalAlpha = 0.18
    ellipseWrapped(ctx, x - radius * 0.2, y - radius * 0.25, radius * 0.7, radius * 0.6, width)
  }
  ctx.globalAlpha = 1
  return finish(canvas)
}

export function makeRingTexture() {
  const width = 1024
  const height = 8
  const { canvas, ctx } = canvas2d(width, height)
  const random = mulberry32(909)
  ctx.clearRect(0, 0, width, height)

  const colors = ['#c8b896', '#a58f70', '#ddd0b2', '#7f6e55', '#d4c3a1']
  for (let i = 0; i < 240; i += 1) {
    const x = random() * width
    const w = 2 + random() * 16
    ctx.fillStyle = colors[Math.floor(random() * colors.length)]
    ctx.globalAlpha = 0.12 + random() * 0.42
    ctx.fillRect(x, 0, w, height)
  }

  ctx.globalAlpha = 1
  const gap = ctx.createLinearGradient(width * 0.58, 0, width * 0.7, 0)
  gap.addColorStop(0, 'rgba(0,0,0,0)')
  gap.addColorStop(0.45, 'rgba(0,0,0,0.85)')
  gap.addColorStop(0.55, 'rgba(0,0,0,0.85)')
  gap.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = gap
  ctx.fillRect(width * 0.58, 0, width * 0.12, height)

  ctx.globalCompositeOperation = 'destination-in'
  const fade = ctx.createLinearGradient(0, 0, width, 0)
  fade.addColorStop(0, 'rgba(0,0,0,0)')
  fade.addColorStop(0.06, 'rgba(0,0,0,0.9)')
  fade.addColorStop(0.9, 'rgba(0,0,0,0.8)')
  fade.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'

  return finish(canvas, { wrap: false })
}

export function makeGlowTexture() {
  const size = 256
  const { canvas, ctx } = canvas2d(size, size)
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.12, 'rgba(255,236,190,0.95)')
  gradient.addColorStop(0.32, 'rgba(255,170,70,0.42)')
  gradient.addColorStop(0.62, 'rgba(255,110,30,0.12)')
  gradient.addColorStop(1, 'rgba(255,90,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return finish(canvas, { wrap: false })
}

export function makeSelectionTexture() {
  const size = 256
  const { canvas, ctx } = canvas2d(size, size)
  const center = size / 2
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 2
  ctx.shadowColor = 'rgba(255,255,255,0.85)'
  ctx.shadowBlur = 10
  ctx.beginPath()
  ctx.arc(center, center, 104, 0, TAU)
  ctx.stroke()

  ctx.globalAlpha = 0.55
  ctx.lineWidth = 1.5
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * TAU
    ctx.beginPath()
    ctx.arc(center, center, 111, angle, angle + 0.08)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  return finish(canvas, { wrap: false })
}
