import { useEffect, useRef, useState } from 'react'
import { ws } from '../lib/gateway'

type Status = 'connecting' | 'open' | 'closed'

export function useSocket<T>(channel: string, onFrame: (frame: T) => void) {
  const [status, setStatus] = useState<Status>('connecting')
  const handler = useRef(onFrame)
  handler.current = onFrame

  useEffect(() => {
    let socket: WebSocket | null = null
    let retry = 0
    let timer: number | undefined
    let disposed = false

    const connect = () => {
      if (disposed) return
      setStatus('connecting')
      socket = new WebSocket(ws(channel))

      socket.onopen = () => {
        retry = 0
        setStatus('open')
      }
      socket.onmessage = (event) => {
        try {
          handler.current(JSON.parse(event.data as string) as T)
        } catch {
          /* a malformed frame must not tear down the stream */
        }
      }
      socket.onclose = () => {
        setStatus('closed')
        if (disposed) return
        const delay = Math.min(500 * 2 ** retry++, 10_000)
        timer = window.setTimeout(connect, delay)
      }
      socket.onerror = () => socket?.close()
    }

    connect()
    return () => {
      disposed = true
      window.clearTimeout(timer)
      socket?.close()
    }
  }, [channel])

  return status
}
