import { invoke } from '@tauri-apps/api/core'
import { load } from '@tauri-apps/plugin-store'
import { saveUser, createSession } from './auth.server'

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  provider: string
  accessToken: string
}

let currentUser: User | null = null
let currentSessionId: string | null = null
let store: Awaited<ReturnType<typeof load>> | null = null

async function getStore() {
  // Don't use Tauri APIs on server-side (SSR)
  if (typeof window === "undefined") {
    throw new Error("getStore() cannot be called on server-side. Use auth.server.ts instead.");
  }
  if (!store) {
    store = await load('user-store.json', {
      defaults: {},
      autoSave: true,
    })
  }
  return store
}

export async function login(provider: 'google' | 'github'): Promise<User> {
  try {
    const userInfo = await invoke<{
      id: string
      name: string
      email: string
      avatar: string | null
      provider: string
      access_token: string
    }>('login_with_provider', { provider })

    currentUser = {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
      avatar: userInfo.avatar || undefined,
      provider: userInfo.provider as 'google' | 'github',
      accessToken: userInfo.access_token,
    }

    // Save user to database
    try {
      await saveUser({
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        avatar: currentUser.avatar,
        provider: currentUser.provider,
        accessToken: currentUser.accessToken,
      })

      // Create session in database
      const session = await createSession({
        userId: currentUser.id,
      })

      if (session) {
        currentSessionId = session.id
      }
    } catch (error) {
      console.error('Failed to save user to database:', error)
      // Continue with login even if database save fails
    }

    // Store user and session in Tauri Store for offline access
    const store = await getStore()
    await store.set('user', currentUser)
    if (currentSessionId) {
      await store.set('sessionId', currentSessionId)
    }
    await store.save()
    console.log('User logged in:', currentUser)

    return currentUser
  } catch (error) {
    console.error('Login failed:', error)
    throw error
  }
}

export async function getCurrentUser(): Promise<User | null> {
  // Don't use Tauri APIs on server-side (SSR)
  if (typeof window === "undefined") {
    // On server-side, return null or try to get from request context
    // For now, return null - the API route should handle authentication differently
    return null;
  }

  // First, try to get user from database session if available
  if (!currentUser) {
    try {
      const store = await getStore()
      const storedSessionId = (await store.get<string>('sessionId')) || null

      // In Tauri-only mode, we only use local storage
      // Session validation is done via Tauri Store

      // Fallback to local storage
      currentUser = (await store.get<User>('user')) || null
      if (currentUser) {
        // Get session ID from store if available
        currentSessionId = (await store.get<string>('sessionId')) || null
        if (!currentSessionId) {
          // Generate a new session ID for local use
          currentSessionId = crypto.randomUUID()
          await store.set('sessionId', currentSessionId)
          await store.save()
        }
      }
    } catch (error) {
      console.error('Failed to get stored user:', error)
    }
  }
  return currentUser
}

export async function logout(): Promise<void> {
  const store = await getStore()

  // In Tauri-only mode, we just clear local storage
  // No database operations needed

  // Clear local state
  currentUser = null
  currentSessionId = null

  // Clear Tauri Store
  await store.delete('user')
  await store.delete('sessionId')
  await store.save()
  console.log('User logged out')
}
