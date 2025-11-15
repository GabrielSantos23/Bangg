import type { UIMessage } from 'ai'

export function getTextFromMessage(message: UIMessage) {
  return (
    message.parts
      ?.filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('') ?? ''
  )
}

export function getImagesFromMessage(message: UIMessage): string[] {
  if (!message.parts) return []

  return message.parts
    .filter((part: any) => part.type === 'image' || part.image || part.data)
    .map((part: any) => {
      const imageData = part.image || part.data || ''
      if (imageData.startsWith('data:')) {
        return imageData
      }
      return `data:image/png;base64,${imageData}`
    })
}
