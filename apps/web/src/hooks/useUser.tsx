import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import {
  type User,
  getCurrentUser,
  login as authLogin,
  logout as authLogout,
} from '@/services/auth'

interface UserContextType {
  user: User | null
  isLoading: boolean
  error: Error | null
  login: (provider: 'google' | 'github') => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserProviderProps {
  children: ReactNode
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refreshUser = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get user')
      setError(error)
      console.error('Failed to refresh user:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (provider: 'google' | 'github') => {
    try {
      setIsLoading(true)
      setError(null)
      const loggedInUser = await authLogin(provider)
      setUser(loggedInUser)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Login failed')
      setError(error)
      console.error('Login failed:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      await authLogout()
      setUser(null)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Logout failed')
      setError(error)
      console.error('Logout failed:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const value: UserContextType = {
    user,
    isLoading,
    error,
    login,
    logout,
    refreshUser,
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
