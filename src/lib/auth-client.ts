// Re-export everything from auth-context so existing imports continue to work.
export {
  useAuth,
  useRequireAuth,
  useRequireActiveProfile,
  useRequireRole,
} from './auth-context'
