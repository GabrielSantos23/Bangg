import { useState, useCallback } from 'react'
import { check, Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { toast } from 'sonner'

export interface UpdateProgress {
  downloaded: number
  total: number
  percentage: number
}

export interface UpdaterState {
  isChecking: boolean
  isDownloading: boolean
  isInstalling: boolean
  updateAvailable: Update | null
  progress: UpdateProgress | null
  error: string | null
}

export const useUpdater = () => {
  const [state, setState] = useState<UpdaterState>({
    isChecking: false,
    isDownloading: false,
    isInstalling: false,
    updateAvailable: null,
    progress: null,
    error: null,
  })

  // Verifica se há atualizações disponíveis
  const checkForUpdates = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isChecking: true,
      error: null,
      updateAvailable: null,
    }))

    try {
      console.log('🔍 Verificando atualizações...')
      const update = await check()

      if (!update) {
        console.log('✅ App já está atualizado')
        toast.info('Você já está usando a versão mais recente!')
        setState((prev) => ({ ...prev, isChecking: false }))
        return null
      }

      console.log(`🎉 Atualização ${update.version} disponível!`)
      console.log(`📅 Data: ${update.date}`)
      console.log(`📝 Notas: ${update.body}`)

      toast.info(`Nova versão ${update.version} disponível!`)

      setState((prev) => ({
        ...prev,
        isChecking: false,
        updateAvailable: update,
      }))

      return update
    } catch (error) {
      console.error('❌ Erro ao verificar atualizações:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido'

      toast.error('Falha ao verificar atualizações.')

      setState((prev) => ({
        ...prev,
        isChecking: false,
        error: errorMessage,
      }))

      return null
    }
  }, [])

  // Baixa e instala a atualização
  const downloadAndInstall = useCallback(async () => {
    if (!state.updateAvailable) {
      toast.error('Nenhuma atualização disponível')
      return
    }

    setState((prev) => ({ ...prev, isDownloading: true, error: null }))

    try {
      console.log('⬇️ Iniciando download da atualização...')

      let downloaded = 0
      let contentLength: number = 0

      await state.updateAvailable.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0
            console.log(`📦 Baixando ${contentLength} bytes`)
            setState((prev) => ({
              ...prev,
              progress: {
                downloaded: 0,
                total: contentLength,
                percentage: 0,
              },
            }))
            break

          case 'Progress':
            downloaded += event.data.chunkLength
            const percentage = Math.round((downloaded / contentLength) * 100)

            console.log(
              `📊 Progresso: ${percentage}% (${downloaded}/${contentLength})`,
            )

            setState((prev) => ({
              ...prev,
              progress: {
                downloaded,
                total: contentLength,
                percentage,
              },
            }))
            break

          case 'Finished':
            console.log('✅ Download concluído!')
            setState((prev) => ({
              ...prev,
              isDownloading: false,
              isInstalling: true,
            }))
            break
        }
      })

      console.log('🎉 Atualização instalada com sucesso!')
      toast.success('Atualização instalada! Reiniciando...')

      // Aguardar 2 segundos antes de reiniciar
      setTimeout(async () => {
        await relaunch()
      }, 2000)
    } catch (error) {
      console.error('❌ Erro ao baixar/instalar atualização:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido'

      toast.error('Falha ao instalar atualização.')

      setState((prev) => ({
        ...prev,
        isDownloading: false,
        isInstalling: false,
        error: errorMessage,
        progress: null,
      }))
    }
  }, [state.updateAvailable])

  // Cancela a atualização (limpa o estado)
  const cancelUpdate = useCallback(() => {
    setState({
      isChecking: false,
      isDownloading: false,
      isInstalling: false,
      updateAvailable: null,
      progress: null,
      error: null,
    })
  }, [])

  return {
    ...state,
    checkForUpdates,
    downloadAndInstall,
    cancelUpdate,
  }
}
