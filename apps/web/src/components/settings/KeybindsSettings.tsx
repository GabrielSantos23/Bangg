import { DEFAULT_SHORTCUT_ACTIONS } from '@/config/shortcut'
import { useMemo } from 'react'
import { Kbd, KbdGroup } from '../ui/kbd'

// Utility: Group shortcuts by section for display
const SECTIONS = [
  {
    id: 'general',
    label: 'General',
    ids: [
      'toggle_visibility',
      'ask_cluely',
      'clear_conversation',
      'toggle_session',
    ],
  },
  {
    id: 'window',
    label: 'Window',
    ids: [
      'move_window_up',
      'move_window_down',
      'move_window_left',
      'move_window_right',
    ],
  },
  {
    id: 'scroll',
    label: 'Scroll',
    ids: ['scroll_response_up', 'scroll_response_down'],
  },
]

// Map for fast title rendering
const ACTION_SECTION_MAP: Record<string, string> = Object.fromEntries(
  SECTIONS.flatMap((section) => section.ids.map((id) => [id, section.id])),
)

function getPlatform(): 'windows' | 'macos' | 'linux' {
  if (typeof window === 'undefined') return 'windows'
  const p = navigator.platform.toLowerCase()
  if (p.includes('mac')) return 'macos'
  if (p.includes('win')) return 'windows'
  return 'linux'
}

const Key = ({ children }: { children: React.ReactNode }) => (
  <KbdGroup>
    <Kbd
      className="inline-flex border  rounded px-2 py-0.5 text-xs font-medium  text-muted-foreground/50 ml-1 mr-1"
      style={{ minWidth: 18, justifyContent: 'center' }}
    >
      {children}
    </Kbd>
  </KbdGroup>
)

function renderKeyCombo(combo: string) {
  // e.g. ctrl+shift+up => [ctrl][shift][↑]
  const map: Record<string, string> = {
    ctrl: 'Ctrl',
    shift: 'Shift',
    alt: 'Alt',
    cmd: 'Cmd',
    backslash: '\\',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
    enter: '⏎',
    return: '⏎',
    r: 'R',
    l: 'L',
  }
  return combo
    .split('+')
    .map((k, i) => (
      <Key key={k + i}>{map[k.toLowerCase()] || k.toUpperCase()}</Key>
    ))
}

export const KeybindsSettings = () => {
  const platform = getPlatform()
  // Group shortcut actions by section for easy display
  const grouped = useMemo(() => {
    const groupMap = Object.fromEntries(
      SECTIONS.map((s) => [s.id, [] as typeof DEFAULT_SHORTCUT_ACTIONS]),
    )
    for (const action of DEFAULT_SHORTCUT_ACTIONS) {
      const section = ACTION_SECTION_MAP[action.id]
      if (section && groupMap[section]) groupMap[section].push(action)
    }
    return groupMap
  }, [])

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-background border rounded-lg m-1 p-6">
      <div>
        <h2 className="text-2xl font-bold text-card-foreground mb-2">
          Keyboard shortcuts
        </h2>
        <div className="text-muted-foreground mb-6 text-sm">
          Cluely works with these easy to remember commands. Click any of the
          keybinds to edit.
        </div>
      </div>
      {SECTIONS.map((section) => (
        <div className="mb-6" key={section.id}>
          <h3 className="font-bold text-card-foreground text-lg mb-2">
            {section.label}
          </h3>
          <div className="space-y-2">
            {grouped[section.id].map((action) => {
              const Icon = action.icon
              return (
                <div className="flex items-center" key={action.id}>
                  <div className="flex items-center w-8 h-8 justify-center mr-3 text-muted-foreground bg-card rounded-lg">
                    {Icon && <Icon className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 font-medium text-card-foreground">
                    {action.name}
                  </div>
                  <div className="flex gap-1 min-w-[120px] justify-end">
                    {renderKeyCombo(
                      action.defaultKey[platform] ||
                        action.defaultKey['windows'],
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
