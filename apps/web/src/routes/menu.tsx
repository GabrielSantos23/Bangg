import { FloatingToolbar } from '@/components/floating-menu/floating-toolbar'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

export const Route = createFileRoute('/menu')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()

  useEffect(() => {
    // Ensure we're on the /menu route when this component mounts
    // This handles the case where the window is created dynamically
    const checkRoute = async () => {
      try {
        const window = getCurrentWindow()
        const label = await window.label()
        if (label === 'menu') {
          // Window is ready, ensure route is correct
          const currentPath = window.location?.pathname || ''
          if (!currentPath.includes('/menu')) {
            navigate({ to: '/menu', replace: true })
          }
        }
      } catch (error) {
        console.error('Error checking window route:', error)
      }
    }

    checkRoute()
  }, [navigate])

  return <div> <FloatingToolbar /></div>
}
