import { motion } from 'framer-motion'
import { LayoutGrid, LayoutList, Columns, Grid2x2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function GridPanel() {
  const layouts = [
    { icon: LayoutGrid, label: 'Grid View', description: '3x3 grid layout' },
    { icon: LayoutList, label: 'List View', description: 'Single column' },
    { icon: Columns, label: 'Two Columns', description: 'Side by side' },
    { icon: Grid2x2, label: 'Compact', description: '2x2 grid layout' },
  ]

  return (
    <div className="p-6">
      <div className="mb-6 text-center">
        <h3 className="mb-2 text-xl font-semibold">Layout Options</h3>
        <p className="text-sm text-muted-foreground">
          Choose your preferred layout style
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {layouts.map((layout, index) => {
          const Icon = layout.icon
          return (
            <motion.div
              key={layout.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <Button
                variant="outline"
                className="h-auto w-full flex-col gap-3 p-4 hover:bg-accent bg-transparent"
              >
                <Icon className="h-6 w-6" />
                <div className="text-center">
                  <div className="text-sm font-medium">{layout.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {layout.description}
                  </div>
                </div>
              </Button>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
