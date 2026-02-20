// Polyfill for Next.js useFormState/useFormStatus hooks
// These are React 19 features, but we're on React 18
// This provides compatibility shims

import { useState, useTransition, useRef } from 'react'

export function useFormState<T>(
  action: (prevState: T, formData: FormData) => Promise<T> | T,
  initialState: T
): [T, (formData: FormData) => void] {
  const [state, setState] = useState<T>(initialState)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement | null>(null)

  const formAction = (formData: FormData) => {
    startTransition(() => {
      const result = action(state, formData)
      if (result instanceof Promise) {
        result.then((newState) => {
          setState(newState)
        })
      } else {
        setState(result)
      }
    })
  }

  return [state, formAction]
}

export function useFormStatus() {
  const [isPending, startTransition] = useTransition()
  return { pending: isPending }
}

