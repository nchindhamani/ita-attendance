// Polyfill for Next.js useFormState/useFormStatus hooks
// These are React 19 features, but we're on React 18
// This provides compatibility shims

import { useState, useTransition } from 'react'

export function useFormState<T>(
  action: (prevState: T, formData: FormData) => Promise<T>,
  initialState: T
): [T, (formData: FormData) => void] {
  const [state, setState] = useState<T>(initialState)
  const [isPending, startTransition] = useTransition()

  const formAction = (formData: FormData) => {
    startTransition(() => {
      action(state, formData).then((result) => {
        setState(result)
      })
    })
  }

  return [state, formAction]
}

export function useFormStatus() {
  const [isPending, startTransition] = useTransition()
  return { pending: isPending }
}

