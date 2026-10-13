function decodeHash(hash: string) {
  try { return decodeURIComponent(hash.slice(1)) } catch { return hash.slice(1) }
}
export function mountOutline(scope: ParentNode) {
  const nav = scope.querySelector<HTMLElement>('#course-outline-links')
  const toggle = scope.querySelector<HTMLButtonElement>('.outline-toggle')
  const media = matchMedia('(max-width: 800px)')
  let expanded = false
  let frame = 0
  const links = Array.from(nav?.querySelectorAll<HTMLAnchorElement>('a[href^="#"]') ?? [])
  const targets = links.flatMap(link => {
    const element = document.getElementById(decodeHash(link.hash))
    return element ? [{ link, element }] : []
  })
  function setExpanded(value: boolean) {
    expanded = value
    if (nav) nav.hidden = media.matches && !expanded
    toggle?.setAttribute('aria-expanded', String(expanded))
    if (toggle) toggle.textContent = expanded ? '收起目录' : '展开目录'
  }
  function updateActive() {
    frame = 0
    let current = targets[0]
    for (const target of targets) {
      if (target.element.getBoundingClientRect().top <= 140) current = target
      else break
    }
    for (const target of targets) {
      if (target === current) target.link.setAttribute('aria-current', 'location')
      else target.link.removeAttribute('aria-current')
    }
  }
  function onScroll() { if (!frame) frame = requestAnimationFrame(updateActive) }
  const onToggle = () => setExpanded(!expanded)
  toggle?.addEventListener('click', onToggle)
  const onResize = () => { setExpanded(false); onScroll() }
  media.addEventListener('change', onResize)
  const cleanups: (() => void)[] = []
  for (const { link, element } of targets) {
    const navigate = (event: MouseEvent) => {
      event.preventDefault()
      setExpanded(false)
      if (location.hash !== link.hash) {
        try { history.pushState(null, '', link.hash) } catch { location.hash = link.hash }
      }
      element.scrollIntoView({ block: 'start' })
      element.setAttribute('tabindex', '-1')
      element.focus({ preventScroll: true })
      updateActive()
    }
    link.addEventListener('click', navigate)
    cleanups.push(() => link.removeEventListener('click', navigate))
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('hashchange', onScroll)
  setExpanded(false)
  updateActive()

  return () => {
    cleanups.forEach(cleanup => cleanup())
    toggle?.removeEventListener('click', onToggle)
    media.removeEventListener('change', onResize)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('hashchange', onScroll)
    cancelAnimationFrame(frame)
  }
}
