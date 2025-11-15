import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export function ModelsPanel() {
  const [selectedModel, setSelectedModel] = useState('gpt-4')

  const models = [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      description: 'Most capable model',
      badge: 'Recommended',
    },
    {
      id: 'gpt-3.5',
      name: 'GPT-3.5 Turbo',
      description: 'Fast and efficient',
      badge: 'Fast',
    },
    {
      id: 'claude',
      name: 'Claude 3',
      description: 'Anthropic model',
      badge: 'New',
    },
  ]

  return (
    <div className="p-6">
      <div className="mb-6 text-center">
        <h3 className="mb-2 text-xl font-semibold">AI Models</h3>
        <p className="text-sm text-muted-foreground">
          Select the AI model for your tasks
        </p>
      </div>

      <div className="space-y-2">
        {models.map((model, index) => (
          <motion.div
            key={model.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Button
              variant="ghost"
              className={cn(
                'h-auto w-full justify-start gap-3 p-4 text-left',
                selectedModel === model.id && 'bg-accent',
              )}
              onClick={() => setSelectedModel(model.id)}
            >
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border-2',
                  selectedModel === model.id
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground',
                )}
              >
                {selectedModel === model.id && (
                  <Check className="h-3 w-3 text-primary-foreground" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{model.name}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {model.badge}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {model.description}
                </p>
              </div>
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
