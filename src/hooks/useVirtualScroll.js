import { useState, useCallback, useRef } from "react"

export function useVirtualScroll({ itemCount, itemWidth, overlap, containerRef, buffer = 3 }) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 })
  const rafRef = useRef(null)

  const updateVisibleRange = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    const spacing = itemWidth - overlap
    const scrollLeft = el.scrollLeft
    const containerWidth = el.clientWidth

    const startIndex = Math.max(0, Math.floor(scrollLeft / spacing) - buffer)
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollLeft + containerWidth) / spacing) + buffer
    )

    setVisibleRange((prev) => {
      if (prev.start === startIndex && prev.end === endIndex) return prev
      return { start: startIndex, end: endIndex }
    })
  }, [itemCount, itemWidth, overlap, containerRef, buffer])

  const onScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(updateVisibleRange)
  }, [updateVisibleRange])

  return { visibleRange, onScroll, updateVisibleRange }
}