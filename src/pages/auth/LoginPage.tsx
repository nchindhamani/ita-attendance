import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from '@/features/auth/LoginForm'

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <Link to="/auth/reset">Forgot password?</Link>
          <Link to="/auth/signup">Request access</Link>
        </div>
      </CardContent>
    </Card>
  )
}


