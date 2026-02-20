import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose signup type</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <Button asChild>
            <Link to="/auth/signup/teacher">Teacher signup</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/auth/signup/admin">Admin signup</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Already have an account? <Link to="/auth/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  )
}
