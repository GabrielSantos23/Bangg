import { motion, AnimatePresence } from 'framer-motion'
import { type ReactNode } from 'react'

interface DashedBorderProps {
  isVisible: boolean
  children: ReactNode
  className?: string
  borderClassName?: string
  padding?: string
  duration?: number
}

export function DashedBorder({
  isVisible,
  children,
  className = 'absolute inset-0 -m-1.5 rounded-full',
  borderClassName = 'border-2 border-dashed border-muted-foreground/30',
  padding = '12px',
  duration = 0.3,
}: DashedBorderProps) {
  return (
    <div className="relative">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration }}
            className={`${className} ${borderClassName} pointer-events-none`}
            style={{ padding }}
          />
        )}
      </AnimatePresence>
      {children}
    </div>
  )
}
