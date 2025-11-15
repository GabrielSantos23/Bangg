import { motion } from 'framer-motion'
import { Book, MessageCircle, FileText, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function HelpPanel() {
  const helpItems = [
    {
      icon: Book,
      title: 'Documentation',
      description: 'Learn how to use all features',
      link: '#',
    },
    {
      icon: MessageCircle,
      title: 'Contact Support',
      description: 'Get help from our team',
      link: '#',
    },
    {
      icon: FileText,
      title: 'Tutorials',
      description: 'Step-by-step guides',
      link: '#',
    },
  ]

  return (
    <div className="p-6">
      <div className="mb-6 text-center">
        <h3 className="mb-2 text-xl font-semibold">Help & Support</h3>
        <p className="text-sm text-muted-foreground">
          Find answers and get assistance
        </p>
      </div>

      <div className="space-y-2">
        {helpItems.map((item, index) => {
          const Icon = item.icon
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Button
                variant="ghost"
                className="h-auto w-full justify-between p-4 text-left hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Button>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
