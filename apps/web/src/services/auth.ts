import { invoke } from '@tauri-apps/api/core'
import { load } from '@tauri-apps/plugin-store'
import {
  saveUser,
  createSession,
  getActiveSession,
  getUserBySession,
  deleteSession,
  deleteUserSessions,
} from './auth.server'

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

    // Save user to Neon database
    try {
      await saveUser({ data: currentUser })
      console.log('User saved to database')

      // Create session in database
      const sessionResult = await createSession({
        data: { userId: currentUser.id },
      })
      if (sessionResult?.id) {
        currentSessionId = sessionResult.id
        console.log('Session created:', currentSessionId)
      }
    } catch (dbError) {
      console.warn('Failed to save user/session to database:', dbError)
      // Continue with local storage even if database fails
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
  // First, try to get user from database session if available
  if (!currentUser) {
    try {
      const store = await getStore()
      const storedSessionId = (await store.get<string>('sessionId')) || null

      if (storedSessionId) {
        // Try to get user from database session
        try {
          const dbUser = await getUserBySession({
            data: { sessionId: storedSessionId },
          })
          if (dbUser) {
            currentUser = dbUser
            currentSessionId = storedSessionId
            // Update local store with fresh data
            await store.set('user', currentUser)
            await store.save()
            console.log('User loaded from database session')
            return currentUser
          } else {
            // Session expired or invalid, clear it
            await store.delete('sessionId')
            await store.save()
          }
        } catch (dbError) {
          console.warn('Failed to get user from database session:', dbError)
          // Fall through to local storage
        }
      }

      // Fallback to local storage
      currentUser = (await store.get<User>('user')) || null
      if (currentUser) {
        // Try to get/create active session for this user
        try {
          const activeSession = await getActiveSession({
            data: { userId: currentUser.id },
          })
          if (activeSession) {
            currentSessionId = activeSession.id
            await store.set('sessionId', currentSessionId)
            await store.save()
          } else {
            // Create a new session if user exists but no active session
            const sessionResult = await createSession({
              data: { userId: currentUser.id },
            })
            if (sessionResult?.id) {
              currentSessionId = sessionResult.id
              await store.set('sessionId', currentSessionId)
              await store.save()
            }
          }
        } catch (dbError) {
          console.warn('Failed to manage session:', dbError)
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

  // Get session ID from store if not in memory
  const sessionId =
    currentSessionId || (await store.get<string>('sessionId')) || null
  const userId = currentUser?.id || null

  // Delete session from database
  if (sessionId) {
    try {
      await deleteSession({ data: { sessionId } })
      console.log('Session deleted from database')
    } catch (error) {
      console.warn('Failed to delete session from database:', error)
    }
  }

  // Also delete all sessions for the user if we have a user ID
  if (userId) {
    try {
      await deleteUserSessions({ data: { userId } })
    } catch (error) {
      console.warn('Failed to delete user sessions:', error)
    }
  }

  // Clear local state
  currentUser = null
  currentSessionId = null

  // Clear Tauri Store
  await store.delete('user')
  await store.delete('sessionId')
  await store.save()
  console.log('User logged out')
}
