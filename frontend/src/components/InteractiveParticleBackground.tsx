import { useEffect, useRef } from 'react'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  hue: number
  saturation: number
  lightness: number
  phase: number
  wanderSpeed: number
  scatterX: number
  scatterY: number
  cursorAngle: number
  cursorRadius: number
  cursorOrbitSpeed: number
  travelSpeed: number
  maxSpeed: number
  shape: ParticleShape
  nextShape: ParticleShape
  shapeChangeAt: number
  shapeTransitionStart: number
  shapeTransitionDuration: number
}

type ParticleShape = 'circle' | 'square' | 'triangle' | 'cross' | 'x'

const PARTICLE_SHAPES: ParticleShape[] = ['circle', 'square', 'triangle', 'cross', 'x']

function drawParticleShape(
  context: CanvasRenderingContext2D,
  shape: ParticleShape,
  x: number,
  y: number,
  size: number,
) {
  context.beginPath()
  if (shape === 'circle') {
    context.arc(x, y, size, 0, Math.PI * 2)
    context.fill()
    return
  }

  if (shape === 'square') {
    const side = size * 1.25
    context.fillRect(x - side / 2, y - side / 2, side, side)
    return
  }

  if (shape === 'triangle') {
    const radius = size * 1.4
    context.moveTo(x, y - radius)
    context.lineTo(x + radius, y + radius)
    context.lineTo(x - radius, y + radius)
    context.closePath()
    context.fill()
    return
  }

  const length = size * 1.35
  context.lineWidth = Math.max(0.65, size * 0.55)
  context.lineCap = 'round'
  context.strokeStyle = context.fillStyle
  if (shape === 'cross') {
    context.moveTo(x - length, y)
    context.lineTo(x + length, y)
    context.moveTo(x, y - length)
    context.lineTo(x, y + length)
  } else {
    context.moveTo(x - length, y - length)
    context.lineTo(x + length, y + length)
    context.moveTo(x + length, y - length)
    context.lineTo(x - length, y + length)
  }
  context.stroke()
}

export function InteractiveParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvasElement: HTMLCanvasElement = canvasRef.current
    const drawingContext = canvasElement.getContext('2d')
    if (!drawingContext) return
    const context: CanvasRenderingContext2D = drawingContext

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarsePointer = window.matchMedia('(pointer: coarse)')
    const pointer = { x: 0, y: 0, active: false }
    let scattering = false
    let animationFrame = 0
    let width = 0
    let height = 0
    let particles: Particle[] = []
    let frameIndex = 0
    let lastScrollX = window.scrollX
    let lastScrollY = window.scrollY
    let scrollWindX = 0
    let scrollWindY = 0

    function resize() {
      const bounds = canvasElement.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      canvasElement.width = Math.floor(width * ratio)
      canvasElement.height = Math.floor(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      const count = Math.min(180, Math.max(70, Math.floor((width * height) / 11000)))
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        size: 0.7 + Math.random() * 1.7,
        hue: 205 + Math.random() * 25,
        saturation: 18 + Math.random() * 42,
        lightness: 50 + Math.random() * 20,
        phase: Math.random() * Math.PI * 2,
        wanderSpeed: 0.08 + Math.random() * 0.16,
        scatterX: Math.random() * width,
        scatterY: Math.random() * height,
        cursorAngle: Math.random() * Math.PI * 2,
        cursorRadius: 100 + Math.random() * 260,
        cursorOrbitSpeed: (Math.random() - 0.5) * 0.0024,
        travelSpeed: 0.7 + Math.random() * 0.8,
        maxSpeed: 0.3 + Math.random() * 0.35,
        shape: 'circle',
        nextShape: 'circle',
        shapeChangeAt: 600 + Math.floor(Math.random() * 1200),
        shapeTransitionStart: 0,
        shapeTransitionDuration: 90 + Math.floor(Math.random() * 60),
      }))
    }

    function draw(staticFrame = false) {
      frameIndex += 1
      context.clearRect(0, 0, width, height)

      if (pointer.active && !reducedMotion.matches && frameIndex % 3 === 0) {
        const distances = particles.map((particle) => Math.hypot(pointer.x - particle.x, pointer.y - particle.y))

        for (let index = 0; index < particles.length; index += 1) {
          for (let otherIndex = index + 1; otherIndex < particles.length; otherIndex += 1) {
            const particle = particles[index]
            const other = particles[otherIndex]
            const dx = other.x - particle.x
            const dy = other.y - particle.y
            const distance = Math.max(0.01, Math.hypot(dx, dy))
            const averageCursorDistance = (distances[index] + distances[otherIndex]) / 2
            const desiredMargin = 10 + Math.min(48, averageCursorDistance * 0.16)

            if (distance < desiredMargin) {
              const force = ((desiredMargin - distance) / desiredMargin) * 0.024
              const directionX = dx / distance
              const directionY = dy / distance
              particle.vx -= directionX * force
              particle.vy -= directionY * force
              other.vx += directionX * force
              other.vy += directionY * force
            }
          }
        }
      }

      for (const particle of particles) {
        if (!staticFrame) {
          if (frameIndex >= particle.shapeChangeAt && particle.nextShape === particle.shape) {
            let nextShape = particle.shape
            while (nextShape === particle.shape) {
              nextShape = PARTICLE_SHAPES[Math.floor(Math.random() * PARTICLE_SHAPES.length)]
            }
            particle.nextShape = nextShape
            particle.shapeTransitionStart = frameIndex
          }

          if (particle.nextShape !== particle.shape) {
            const transitionProgress =
              (frameIndex - particle.shapeTransitionStart) / particle.shapeTransitionDuration
            if (transitionProgress >= 1) {
              particle.shape = particle.nextShape
              particle.shapeChangeAt = frameIndex + 600 + Math.floor(Math.random() * 1200)
              particle.nextShape = particle.shape
            }
          }

          const windVariation = 0.75 + particle.travelSpeed * 0.3
          particle.vx += scrollWindX * windVariation
          particle.vy += scrollWindY * windVariation

          particle.phase += 0.008 + particle.wanderSpeed * 0.018
          const targetVx = Math.cos(particle.phase) * particle.wanderSpeed * particle.travelSpeed
          const targetVy = Math.sin(particle.phase * 0.73) * particle.wanderSpeed * particle.travelSpeed
          const steering = 0.01 + particle.travelSpeed * 0.004
          particle.vx += (targetVx - particle.vx) * steering
          particle.vy += (targetVy - particle.vy) * steering

          if (scattering) {
            const dx = particle.scatterX - particle.x
            const dy = particle.scatterY - particle.y
            const distance = Math.max(1, Math.hypot(dx, dy))
            const force = Math.min(0.028, distance * 0.00014)
            particle.vx += (dx / distance) * force
            particle.vy += (dy / distance) * force
          }

          if (pointer.active && !reducedMotion.matches) {
            particle.cursorAngle += particle.cursorOrbitSpeed
            const targetX = pointer.x + Math.cos(particle.cursorAngle) * particle.cursorRadius
            const targetY = pointer.y + Math.sin(particle.cursorAngle) * particle.cursorRadius
            const dx = targetX - particle.x
            const dy = targetY - particle.y
            const targetDistance = Math.max(1, Math.hypot(dx, dy))
            const cursorDistance = Math.hypot(pointer.x - particle.x, pointer.y - particle.y)
            const distanceFactor = Math.min(cursorDistance / 160, 4)
            const attraction = Math.min(0.8, 0.035 * Math.exp(distanceFactor))
            particle.vx += (dx / targetDistance) * attraction
            particle.vy += (dy / targetDistance) * attraction
          }

          const speed = Math.hypot(particle.vx, particle.vy)
          const cursorSpeedBoost =
            pointer.active && !reducedMotion.matches
              ? Math.min(1.9, Math.min(4, Math.hypot(pointer.x - particle.x, pointer.y - particle.y) / 160) * 0.6)
              : 0
          const speedLimit = particle.maxSpeed + cursorSpeedBoost
          if (speed > speedLimit) {
            particle.vx = (particle.vx / speed) * speedLimit
            particle.vy = (particle.vy / speed) * speedLimit
          }
          particle.x += particle.vx
          particle.y += particle.vy
          const edgePadding = particle.size
          if (particle.x < edgePadding) {
            particle.x = edgePadding
            particle.vx = Math.abs(particle.vx)
          } else if (particle.x > width - edgePadding) {
            particle.x = width - edgePadding
            particle.vx = -Math.abs(particle.vx)
          }
          if (particle.y < edgePadding) {
            particle.y = edgePadding
            particle.vy = Math.abs(particle.vy)
          } else if (particle.y > height - edgePadding) {
            particle.y = height - edgePadding
            particle.vy = -Math.abs(particle.vy)
          }
        }

        const speed = Math.hypot(particle.vx, particle.vy)
        const opacity = 0.2 + Math.min(particle.size / 5 + speed * 0.45, 0.42)
        context.fillStyle = `hsl(${particle.hue} ${particle.saturation}% ${particle.lightness}%)`
        const transitionProgress =
          particle.nextShape === particle.shape
            ? 0
            : Math.min(1, (frameIndex - particle.shapeTransitionStart) / particle.shapeTransitionDuration)
        context.save()
        context.globalAlpha = opacity * (1 - transitionProgress)
        drawParticleShape(context, particle.shape, particle.x, particle.y, particle.size)
        if (transitionProgress > 0) {
          context.globalAlpha = opacity * transitionProgress
          drawParticleShape(context, particle.nextShape, particle.x, particle.y, particle.size)
        }
        context.restore()
      }
      scrollWindX *= 0.93
      scrollWindY *= 0.93
    }

    function animate() {
      draw()
      animationFrame = window.requestAnimationFrame(animate)
    }

    function handlePointerMove(event: PointerEvent) {
      if (coarsePointer.matches) return
      pointer.x = event.clientX
      pointer.y = event.clientY
      pointer.active =
        pointer.x >= 0 &&
        pointer.x <= width &&
        pointer.y >= 0 &&
        pointer.y <= height
      scattering = false
    }

    function resetToScatter() {
      if (!pointer.active && scattering) return
      pointer.active = false
      scattering = true
      for (const particle of particles) {
        particle.scatterX = Math.random() * width
        particle.scatterY = Math.random() * height
        particle.vx = (Math.random() - 0.5) * particle.wanderSpeed
        particle.vy = (Math.random() - 0.5) * particle.wanderSpeed
      }
    }

    function handlePointerLeave() {
      resetToScatter()
    }

    function handleScroll() {
      const currentScrollX = window.scrollX
      const currentScrollY = window.scrollY
      const deltaX = currentScrollX - lastScrollX
      const deltaY = currentScrollY - lastScrollY
      lastScrollX = currentScrollX
      lastScrollY = currentScrollY

      if (reducedMotion.matches) return
      scrollWindX = Math.max(-0.2, Math.min(0.2, scrollWindX - deltaX * 0.0018))
      scrollWindY = Math.max(-0.2, Math.min(0.2, scrollWindY - deltaY * 0.0018))
    }

    function handleMouseOut(event: MouseEvent) {
      if (event.relatedTarget === null) resetToScatter()
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerleave', handlePointerLeave)
    window.addEventListener('mouseout', handleMouseOut)
    document.addEventListener('mouseleave', resetToScatter)
    window.addEventListener('blur', resetToScatter)

    if (reducedMotion.matches) {
      draw(true)
    } else {
      animate()
    }

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', handlePointerLeave)
      window.removeEventListener('mouseout', handleMouseOut)
      document.removeEventListener('mouseleave', resetToScatter)
      window.removeEventListener('blur', resetToScatter)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-80"
    />
  )
}
