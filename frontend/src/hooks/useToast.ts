import { useState, useCallback } from 'react'

export interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

let toastListeners: Array<(toasts: Toast[]) => void> = []
let toastList: Toast[] = []

function notify() {
  toastListeners.forEach((l) => l([...toastList]))
}

export function toast(options: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  const t: Toast = { id, ...options }
  toastList = [...toastList, t]
  notify()
  setTimeout(() => {
    toastList = toastList.filter((x) => x.id !== id)
    notify()
  }, 4000)
}

export function useToastState() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const subscribe = useCallback((listener: (t: Toast[]) => void) => {
    toastListeners.push(listener)
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener)
    }
  }, [])

  return { toasts, setToasts, subscribe }
}

export function useToast() {
  return { toast }
}
