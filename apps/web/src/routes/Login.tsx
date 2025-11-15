import { Button } from '@/components/ui/button'
import { useUser } from '@/hooks/useUser'
import { login } from '@/services/auth'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2, LoaderPinwheel } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

export const Route = createFileRoute('/Login')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { login, user } = useUser()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isGithubLoading, setIsGithubLoading] = useState(false)
  const isLoading = isGoogleLoading || isGithubLoading

  useEffect(() => {
    if (user) {
      navigate({ to: '/' })
    }
  }, [user, navigate])

  async function loginWithGoogle() {
    try {
      setIsGoogleLoading(true)
      await login('google')
      navigate({ to: '/' })
    } catch (error) {
      console.error('Google login failed:', error)
      toast.error('Login Failed')
    } finally {
      setIsGoogleLoading(false)
    }
  }

  async function loginWithGithub() {
    try {
      setIsGithubLoading(true)
      await login('github')
      navigate({ to: '/' })
    } catch (error) {
      console.error('GitHub login failed:', error)
      toast.error('Login Failed')
    } finally {
      setIsGithubLoading(false)
    }
  }

  // Don't render login form if user is already logged in
  if (user) {
    return null
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  }

  return (
    <motion.div
      className="w-full h-screen flex items-center justify-center bg-background"
      initial="hidden"
      animate="visible"
    >
      <motion.div
        className="flex flex-col items-center justify-center gap-8"
        variants={containerVariants}
      >
        <motion.div
          className="w-32 h-32 rounded-full bg-muted flex items-center justify-center"
          variants={itemVariants}
        >
          <LoaderPinwheel className="w-20 h-20 text-blue-300" />
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-2"
          variants={itemVariants}
        >
          <h1 className="text-5xl font-semibold">Welcome to Bangg</h1>
          <p className="text-lg text-muted-foreground">
            Your AI meeting assistant
          </p>
        </motion.div>

        <motion.div
          className="flex flex-col gap-3 w-full max-w-xs mt-4"
          variants={itemVariants}
        >
          <Button
            variant="secondary"
            onClick={loginWithGoogle}
            disabled={isLoading}
            className="w-full h-12 text-muted-foreground hover:text-card-foreground border-0 rounded-lg text-base"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Continue with Google'
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={loginWithGithub}
            disabled={isLoading}
            className="w-full h-12 text-muted-foreground hover:text-card-foreground border-0 rounded-lg text-base"
          >
            {isGithubLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Continue with Github'
            )}
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
