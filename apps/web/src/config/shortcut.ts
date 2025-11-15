import { type ShortcutAction } from '@/lib/shortcutInterface'
import {
  ArrowDown,
  ArrowDownNarrowWide,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpNarrowWide,
  AudioLines,
  Brain,
  Eraser,
  Terminal,
} from 'lucide-react'

export const STORAGE_KEYS = {
  SHORTCUTS: 'app_shortcuts_config',
}

export const DEFAULT_SHORTCUT_ACTIONS: ShortcutAction[] = [
  {
    id: 'toggle_window',
    icon: Terminal,
    name: 'Toggle visibility of Cluely',
    description: 'Show/Hide the main window',
    defaultKey: {
      macos: 'cmd+backslash',
      windows: 'ctrl+backslash',
      linux: 'ctrl+backslash',
    },
  },
  {
    id: 'ask_cluely',
    icon: Brain,
    name: 'Ask Cluely about your screen or audio',
    description: 'Ask Cluely about your screen or audio',
    defaultKey: {
      macos: 'cmd+l',
      windows: 'ctrl+l',
      linux: 'ctrl+l',
    },
  },
  {
    id: 'clear_conversation',
    icon: Eraser,
    name: 'Clear the current conversation with Cluely',
    description: 'Clear the current conversation',
    defaultKey: {
      macos: 'cmd+r',
      windows: 'ctrl+r',
      linux: 'ctrl+r',
    },
  },
  {
    id: 'toggle_session',
    icon: AudioLines,
    name: 'Start or stop a Cluely session',
    description: 'Start or stop a Cluely session',
    defaultKey: {
      macos: 'cmd+shift+backslash',
      windows: 'ctrl+shift+backslash',
      linux: 'ctrl+shift+backslash',
    },
  },

  // --- Original Shortcuts (Retained as requested) ---
  {
    id: 'audio_recording',
    icon: AudioLines,
    name: 'Voice Input',
    description: 'Start voice recording',
    defaultKey: {
      macos: 'cmd+shift+a',
      windows: 'ctrl+shift+a',
      linux: 'ctrl+shift+a',
    },
  },
  {
    id: 'system_audio',
    icon: AudioLines,
    name: 'System Audio',
    description: 'Toggle system audio capture',
    defaultKey: {
      macos: 'cmd+shift+m',
      windows: 'ctrl+shift+m',
      linux: 'ctrl+shift+m',
    },
  },
  {
    id: 'screenshot',
    icon: AudioLines,
    name: 'Screenshot',
    description: 'Capture screenshot',
    defaultKey: {
      macos: 'cmd+shift+s',
      windows: 'ctrl+shift+s',
      linux: 'ctrl+shift+s',
    },
  },

  // --- Window Shortcuts (New additions from image) ---
  {
    id: 'move_window_up',
    icon: ArrowUp,
    name: 'Move the window position up',
    description: 'Move the main window up by a step',
    defaultKey: {
      macos: 'cmd+up',
      windows: 'ctrl+up',
      linux: 'ctrl+up',
    },
  },
  {
    id: 'move_window_down',
    icon: ArrowDown,
    name: 'Move the window position down',
    description: 'Move the main window down by a step',
    defaultKey: {
      macos: 'cmd+down',
      windows: 'ctrl+down',
      linux: 'ctrl+down',
    },
  },
  {
    id: 'move_window_left',
    icon: ArrowLeft,
    name: 'Move the window position left',
    description: 'Move the main window left by a step',
    defaultKey: {
      macos: 'cmd+left',
      windows: 'ctrl+left',
      linux: 'ctrl+left',
    },
  },
  {
    id: 'move_window_right',
    icon: ArrowRight,
    name: 'Move the window position right',
    description: 'Move the main window right by a step',
    defaultKey: {
      macos: 'cmd+right',
      windows: 'ctrl+right',
      linux: 'ctrl+right',
    },
  },

  // --- Scroll Shortcuts (New additions from image) ---
  {
    id: 'scroll_response_up',
    icon: ArrowUpNarrowWide,
    name: 'Scroll the response window up',
    description: 'Scroll the response/chat window up',
    defaultKey: {
      macos: 'cmd+shift+up',
      windows: 'ctrl+shift+up',
      linux: 'ctrl+shift+up',
    },
  },
  {
    id: 'scroll_response_down',
    icon: ArrowDownNarrowWide,
    name: 'Scroll the response window down',
    description: 'Scroll the response/chat window down',
    defaultKey: {
      macos: 'cmd+shift+down',
      windows: 'ctrl+shift+down',
      linux: 'ctrl+shift+down',
    },
  },
]
