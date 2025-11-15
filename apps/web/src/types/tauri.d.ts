interface Window {
  __TAURI__?: {
    invoke: <T = any>(cmd: string, args?: Record<string, any>) => Promise<T>
    event: {
      listen: <T = any>(
        event: string,
        handler: (event: { event: string; payload: T }) => void,
      ) => Promise<() => void>
      emit: (event: string, payload?: any) => Promise<void>
    }
  }
}

declare global {
  interface Window {
    __TAURI__?: {
      invoke: <T = any>(cmd: string, args?: Record<string, any>) => Promise<T>
      event: {
        listen: <T = any>(
          event: string,
          handler: (event: { event: string; payload: T }) => void,
        ) => Promise<() => void>
        emit: (event: string, payload?: any) => Promise<void>
      }
    }
  }
}

export {}
