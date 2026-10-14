// Native SVG animation islands: static markup remains the source of truth.
export function mountDiagrams(root: ParentNode = document): () => void {
  const dispose: Array<() => void> = []
  for (const figure of Array.from(root.querySelectorAll<HTMLElement>('[data-course-animation]'))) {
    const svg = figure.querySelector<SVGSVGElement>('svg')
    const controls = figure.querySelector<HTMLElement>('[data-course-animation-controls]')
    const play = controls?.querySelector<HTMLButtonElement>('[data-course-animation-play]')
    const pause = controls?.querySelector<HTMLButtonElement>('[data-course-animation-pause]')
    const reset = controls?.querySelector<HTMLButtonElement>('[data-course-animation-reset]')
    const animations = svg?.querySelectorAll<SVGAnimationElement>('animate, animateMotion, animateTransform, set')
    if (!svg || !controls || !play || !pause || !reset || !animations?.length ||
      typeof svg.pauseAnimations !== 'function' || typeof svg.setCurrentTime !== 'function' ||
      typeof svg.unpauseAnimations !== 'function' ||
      Array.from(animations).some(animation => animation.getAttribute('begin') !== 'indefinite' || typeof animation.beginElement !== 'function')) continue

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let started = false
    const stop = () => {
      svg.pauseAnimations()
      play.disabled = false
      pause.disabled = true
    }
    const restart = () => {
      stop()
      svg.setCurrentTime(0)
    }
    const start = () => {
      if (motion.matches) return
      if (!started) {
        svg.setCurrentTime(0)
        animations.forEach(animation => animation.beginElement())
        started = true
      }
      svg.unpauseAnimations()
      play.disabled = true
      pause.disabled = false
    }
    const preference = () => {
      if (motion.matches) restart()
      controls.hidden = motion.matches
    }
    const visibility = () => { if (document.hidden) stop() }
    restart()
    preference()
    play.addEventListener('click', start)
    pause.addEventListener('click', stop)
    reset.addEventListener('click', restart)
    motion.addEventListener('change', preference)
    document.addEventListener('visibilitychange', visibility)
    dispose.push(() => {
      stop()
      controls.hidden = true
      play.removeEventListener('click', start)
      pause.removeEventListener('click', stop)
      reset.removeEventListener('click', restart)
      motion.removeEventListener('change', preference)
      document.removeEventListener('visibilitychange', visibility)
    })
  }
  return () => dispose.forEach(cleanup => cleanup())
}
