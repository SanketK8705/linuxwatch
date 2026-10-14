import { memo, useEffect, useState } from 'react'
import LiquidEther from './LiquidEther'

const ETHER_COLORS = ['#e8590c', '#0ea5e9', '#1a1a1a']

const LiquidEtherBackground = memo(function LiquidEtherBackground() {
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (reducedMotion) return

    let scrollTimer
    const onScroll = () => {
      setPaused(true)
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => setPaused(false), 250)
    }

    const main = document.querySelector('main')
    main?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      main?.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
      clearTimeout(scrollTimer)
    }
  }, [reducedMotion])

  if (reducedMotion) {
    return <div className="liquid-bg liquid-bg--static" aria-hidden="true" />
  }

  return (
    <div className="liquid-bg" aria-hidden="true">
      <LiquidEther
        colors={ETHER_COLORS}
        autoDemo
        autoIntensity={1.2}
        resolution={0.25}
        iterationsViscous={16}
        iterationsPoisson={16}
        isViscous={false}
        BFECC={false}
        mouseForce={8}
        cursorSize={60}
        paused={paused}
      />
    </div>
  )
})

export default LiquidEtherBackground
