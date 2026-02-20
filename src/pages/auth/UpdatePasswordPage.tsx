import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UpdatePasswordForm } from '@/features/auth/UpdatePasswordForm'

export default function UpdatePasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Update password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <UpdatePasswordForm />
        <p className="text-sm text-muted-foreground">
          <Link to="/auth/login" className="text-primary hover:underline">Back to sign in</Link>
        </p>
      </CardContent>
    </Card>
  )
}
