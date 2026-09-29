// Material light is intentionally opt-in. Most content surfaces, media, dialogs and
// feeds stay still so the effect remains a quiet material cue instead of following
// the pointer through the entire application.
const SURFACE_SELECTOR = '[data-material-light="subtle"]'

const supportsFinePointer = () =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  !window.matchMedia('(prefers-reduced-transparency: reduce)').matches

const getSurface = (target) => {
  if (!(target instanceof Element)) return null
  const surface = target.closest(SURFACE_SELECTOR)
  if (!surface || surface.matches('[data-no-surface-light], [aria-disabled="true"]')) return null
  return surface
}

/**
 * Adds a small, theme-aware light reflection to functional surfaces under the pointer.
 * The listener is shared at document level and batched through requestAnimationFrame so
 * cards do not each allocate their own pointer handler.
 */
export const attachSurfaceLight = (root = document) => {
  if (typeof window === 'undefined' || !supportsFinePointer()) return () => {}

  let activeSurface = null
  let frame = 0
  let latestEvent = null

  const restoreSurface = () => {
    if (!activeSurface) return
    activeSurface.style.removeProperty('--surface-light-x')
    activeSurface.style.removeProperty('--surface-light-y')
    activeSurface.removeAttribute('data-surface-light')
    activeSurface = null
  }

  const activateSurface = (surface) => {
    if (surface === activeSurface) return
    restoreSurface()
    if (!surface) return

    activeSurface = surface
    surface.setAttribute('data-surface-light', 'true')
  }

  const render = () => {
    frame = 0
    const event = latestEvent
    if (!event) return

    const surface = getSurface(event.target)
    activateSurface(surface)
    if (!surface) return

    const rect = surface.getBoundingClientRect()
    surface.style.setProperty('--surface-light-x', `${event.clientX - rect.left}px`)
    surface.style.setProperty('--surface-light-y', `${event.clientY - rect.top}px`)
  }

  const handlePointerMove = (event) => {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
    latestEvent = event
    if (!frame) frame = window.requestAnimationFrame(render)
  }

  const handlePointerLeave = () => {
    latestEvent = null
    if (frame) window.cancelAnimationFrame(frame)
    frame = 0
    restoreSurface()
  }

  root.addEventListener('pointermove', handlePointerMove, { passive: true })
  root.addEventListener('pointerleave', handlePointerLeave, { passive: true })
  window.addEventListener('blur', handlePointerLeave)

  return () => {
    root.removeEventListener('pointermove', handlePointerMove)
    root.removeEventListener('pointerleave', handlePointerLeave)
    window.removeEventListener('blur', handlePointerLeave)
    handlePointerLeave()
  }
}
