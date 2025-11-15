import { motion } from 'framer-motion'
import { User, Bell, Lock, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useState } from 'react'

export function SettingsPanel() {
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(false)

  const settings = [
    {
      icon: User,
      title: 'Profile Settings',
      description: 'Manage your account',
      action: 'button' as const,
    },
    {
      icon: Bell,
      title: 'Notifications',
      description: 'Enable push notifications',
      action: 'toggle' as const,
      value: notifications,
      onChange: setNotifications,
    },
    {
      icon: Palette,
      title: 'Dark Mode',
      description: 'Toggle dark theme',
      action: 'toggle' as const,
      value: darkMode,
      onChange: setDarkMode,
    },
    {
      icon: Lock,
      title: 'Privacy',
      description: 'Security settings',
      action: 'button' as const,
    },
  ]

  return (
    <div className="max-h-[32rem] overflow-y-auto p-6">
      <div className="mb-6 text-center">
        <h3 className="mb-2 text-xl font-semibold">Settings</h3>
        <p className="text-sm text-muted-foreground">
          Customize your experience
        </p>
      </div>

      <div className="space-y-2">
        {settings.map((setting, index) => {
          const Icon = setting.icon
          return (
            <motion.div
              key={setting.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between rounded-lg p-4 hover:bg-accent"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{setting.title}</div>
                  <p className="text-sm text-muted-foreground">
                    {setting.description}
                  </p>
                </div>
              </div>
              {setting.action === 'toggle' ? (
                <Switch
                  checked={setting.value}
                  onCheckedChange={setting.onChange}
                />
              ) : (
                <Button variant="ghost" size="sm">
                  Edit
                </Button>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
