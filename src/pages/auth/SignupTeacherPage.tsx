import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SignupForm } from '@/features/auth/SignupForm'

export default function SignupTeacherPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Teacher signup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SignupForm role="teacher" requireTeacherFields />
        <p className="text-sm text-muted-foreground">
          Already have an account? <Link to="/auth/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  )
}
