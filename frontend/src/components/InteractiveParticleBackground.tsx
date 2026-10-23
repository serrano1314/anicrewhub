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
        cursorRadius: 90 + Math.random() * 280,
        cursorOrbitSpeed: (Math.random() - 0.5) * 0.0024,
      }))
    }

    function draw(staticFrame = false) {
      frameIndex += 1
      context.clearRect(0, 0, width, height)

      if (pointer.active && !reducedMotion.matches && frameIndex % 3 === 0) {
        const distances = particles.map((particle) => Math.hypot(pointer.x - particle.x, pointer.y - particle.y))
        const maxDimension = Math.max(width, height)

        for (let index = 0; index < particles.length; index += 1) {
          for (let otherIndex = index + 1; otherIndex < particles.length; otherIndex += 1) {
            const particle = particles[index]
            const other = particles[otherIndex]
            const dx = other.x - particle.x
            const dy = other.y - particle.y
            const distance = Math.max(0.01, Math.hypot(dx, dy))
            const desiredMargin = 10 + Math.min(24, ((distances[index] + distances[otherIndex]) / 2 / maxDimension) * 30)

            if (distance < desiredMargin) {
              const force = ((desiredMargin - distance) / desiredMargin) * 0.018
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
          particle.phase += 0.008 + particle.wanderSpeed * 0.018
          const targetVx = Math.cos(particle.phase) * particle.wanderSpeed
          const targetVy = Math.sin(particle.phase * 0.73) * particle.wanderSpeed
          particle.vx += (targetVx - particle.vx) * 0.012
          particle.vy += (targetVy - particle.vy) * 0.012

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
            const distance = Math.max(1, Math.hypot(dx, dy))
            const attraction = Math.min(0.035, 0.004 + distance * 0.00008)
            particle.vx += (dx / distance) * attraction
            particle.vy += (dy / distance) * attraction
          }

          const speed = Math.hypot(particle.vx, particle.vy)
          if (speed > 0.7) {
            particle.vx = (particle.vx / speed) * 0.7
            particle.vy = (particle.vy / speed) * 0.7
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
        context.fillStyle = `hsla(${particle.hue}, ${particle.saturation}%, ${particle.lightness}%, ${opacity})`
        context.beginPath()
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        context.fill()
      }
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

    function handleMouseOut(event: MouseEvent) {
      if (event.relatedTarget === null) resetToScatter()
    }

    resize()
    window.addEventListener('resize', resize)
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
