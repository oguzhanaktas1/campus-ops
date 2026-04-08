'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiRegister, setAuth } from '@/lib/auth';

export default function SignUpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiRegister({
        email: form.email,
        password: form.password,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
      });

      setAuth(data.access_token, data.user);
      toast.success('Account created! Redirecting…');
      router.push('/student/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-sidebar flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <GraduationCap className="size-5 text-sidebar-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-sidebar-foreground">CampusOps</span>
        </Link>
        <div className="space-y-4">
          {[
            'Role-based access for students, faculty, and staff',
            'Automated approval workflows',
            'Real-time request tracking and notifications',
            'Centralized calendar and room booking',
          ].map((item) => (
            <div key={item} className="flex items-start gap-3">
              <div className="size-5 rounded-full bg-sidebar-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="size-1.5 rounded-full bg-sidebar-primary" />
              </div>
              <p className="text-sidebar-foreground/80 text-sm">{item}</p>
            </div>
          ))}
        </div>
        <p className="text-sidebar-foreground/40 text-xs">Smart Campus Operations Platform</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Link href="/" className="lg:hidden flex items-center gap-2 mb-6">
              <div className="size-7 rounded bg-primary flex items-center justify-center">
                <GraduationCap className="size-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground">CampusOps</span>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
            <p className="text-muted-foreground text-sm mt-1">
              New students register here — staff &amp; faculty accounts are provisioned by admins.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="Alex"
                  value={form.firstName}
                  onChange={set('firstName')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Johnson"
                  value={form.lastName}
                  onChange={set('lastName')}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">University Email</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@campus.edu"
                value={form.email}
                onChange={set('email')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={form.password}
                onChange={set('password')}
              />
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Create Account <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
