'use client'
import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Settings,
  Calendar,
  Keyboard,
  User,
  Languages,
  CreditCard,
  GraduationCap,
  Bug,
  HelpCircle,
  LogOut,
  X,
  Power,
  Palette,
  ChevronDown,
  Eye,
  BookOpen,
} from 'lucide-react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { GeneralSettings } from './GeneralSettings'
import { KeybindsSettings } from './KeybindsSettings'
import { useNavigate } from '@tanstack/react-router'
import { useUser } from '@/hooks/useUser'

const menuItems = [
  { id: 'general', title: 'General', icon: Settings },
  { id: 'calendar', title: 'Calendar', icon: Calendar },
  { id: 'keybinds', title: 'Keybinds', icon: Keyboard },
  { id: 'profile', title: 'Profile', icon: User },
  { id: 'language', title: 'Language', icon: Languages },
  { id: 'billing', title: 'Billing', icon: CreditCard },
]

const supportItems = [
  { id: 'tutorial', title: 'Cluely Tutorial', icon: GraduationCap },
  { id: 'changelog', title: 'Changelog', icon: BookOpen },
  { id: 'help', title: 'Help Center', icon: HelpCircle },
  { id: 'bug', title: 'Report a bug', icon: Bug },
]

// Placeholder Components
const CalendarSettings = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold text-white mb-2">Calendar Settings</h2>
    <p className="text-gray-400">Calendar settings will be configured here.</p>
  </div>
)

const ProfileSettings = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold text-white mb-2">Profile</h2>
    <p className="text-gray-400">Manage your profile settings.</p>
  </div>
)

const LanguageSettings = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold text-white mb-2">Language</h2>
    <p className="text-gray-400">Choose your preferred language.</p>
  </div>
)

const BillingSettings = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold text-white mb-2">Billing</h2>
    <p className="text-gray-400">Manage your billing and subscription.</p>
  </div>
)

const TutorialSettings = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold text-white mb-2">Cluely Tutorial</h2>
    <p className="text-gray-400">Learn how to use Cluely.</p>
  </div>
)

const ChangelogSettings = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold text-white mb-2">Changelog</h2>
    <p className="text-gray-400">See what's new in Cluely.</p>
  </div>
)

const HelpSettings = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold text-white mb-2">Help Center</h2>
    <p className="text-gray-400">Get help with Cluely.</p>
  </div>
)

const BugReportSettings = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold text-white mb-2">Report a Bug</h2>
    <p className="text-gray-400">Help us improve by reporting issues.</p>
  </div>
)

interface SettingsComponentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const SettingsComponent = ({
  open,
  onOpenChange,
}: SettingsComponentProps) => {
  const [activeSection, setActiveSection] = useState('general')
  const { user, isLoading, login, logout } = useUser()

  const navigate = useNavigate()
  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return <GeneralSettings />
      case 'calendar':
        return <CalendarSettings />
      case 'keybinds':
        return <KeybindsSettings />
      case 'profile':
        return <ProfileSettings />
      case 'language':
        return <LanguageSettings />
      case 'billing':
        return <BillingSettings />
      case 'tutorial':
        return <TutorialSettings />
      case 'changelog':
        return <ChangelogSettings />
      case 'help':
        return <HelpSettings />
      case 'bug':
        return <BugReportSettings />
      default:
        return <GeneralSettings />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl!  w-screen!  [&>button]:hidden  bg-card h-[80vh]! max-h-[80vh]! p-0  border border-muted ">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-64    flex flex-col">
            {/* Close button */}
            <div className="p-4 ">
              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto py-4">
              <nav className="space-y-1 px-3">
                {menuItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group ${
                        activeSection === item.id
                          ? '  bg-secondary rounded-full text-card-foreground '
                          : 'text-muted-foreground hover:bg-secondary hover:text-muted-foreground'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </button>
                  )
                })}
              </nav>

              {/* Support Section */}
              <div className="mt-6 px-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
                  Support
                </div>
                <nav className="space-y-1">
                  {supportItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          activeSection === item.id
                            ? 'bg-secondary text-card-foreground'
                            : 'text-muted-foreground hover:bg-secondary hover:text-muted-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </button>
                    )
                  })}
                </nav>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className=" p-3 space-y-1">
              <button
                onClick={() => logout()}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-card-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-card-foreground transition-colors">
                <Power className="w-4 h-4" />
                <span>Quit Cluely</span>
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col bg-card h-[80vh] rounded-lg ">
            {renderContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function Demo() {
  const [open, setOpen] = useState(true)

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <Button onClick={() => setOpen(true)}>Open Settings</Button>
      <SettingsComponent open={open} onOpenChange={setOpen} />
    </div>
  )
}
