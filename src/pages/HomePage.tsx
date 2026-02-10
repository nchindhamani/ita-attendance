import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  // Smoke Test 1: Test Python API connection
  useEffect(() => {
    fetch('/api/test')
      .then(res => res.json())
      .then(data => {
        console.log('✅ Python API Test:', data)
      })
      .catch(err => {
        console.error('❌ Python API Test Failed:', err)
      })
  }, [])

  // Smoke Test 2: Environment Variables Check
  useEffect(() => {
    console.log('🔑 Environment Variables Check:')
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing')
    console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing')
    console.log('Full URL:', import.meta.env.VITE_SUPABASE_URL)
  }, [])

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-8">
          <div>
            <p className="text-sm font-semibold text-primary">ITA</p>
            <h1 className="text-xl font-heading font-semibold">Attendance Hub</h1>
          </div>
          <div className="flex items-center gap-6" />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-8 py-24">
        <section className="flex flex-col items-center text-center">
          <div className="space-y-8">
            <p className="text-sm font-semibold text-primary">Modern & Secure</p>
            <h2 className="text-5xl font-heading font-semibold leading-tight">
              Attendance tracking built for ITA teachers and admins.
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Secure, admin-approved access for teachers and staff.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <Button asChild size="lg">
                <Link to="/auth/signup">Sign up</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/auth/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

