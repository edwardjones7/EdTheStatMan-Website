'use client'

import { useState } from 'react'
import { signup } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'

function Eye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

const rules = [
  { key: 'length',    label: 'At least 8 characters',  test: (p: string) => p.length >= 8 },
  { key: 'upper',     label: 'One uppercase letter',    test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower',     label: 'One lowercase letter',    test: (p: string) => /[a-z]/.test(p) },
  { key: 'symbol',    label: 'One symbol (!@#$…)',      test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export default function SignupForm() {
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const allRulesPassed = rules.every(r => r.test(password))
  const passwordsMatch = password === confirm

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!allRulesPassed) {
      setError('Password does not meet the requirements.')
      return
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const formData = new FormData(e.currentTarget)
    await signup(formData)
    setLoading(false)
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="auth-form">
      <button
        type="button"
        className="btn btn--google"
        onClick={handleGoogle}
        disabled={googleLoading}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        {googleLoading ? 'Redirecting...' : 'Continue with Google'}
      </button>

      <div className="auth-divider"><span>or</span></div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            className="form-input"
            placeholder="your@email.com"
            required
            autoComplete="email"
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="input-reveal">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="••••••••"
              required
              value={password}
              onChange={e => { setPassword(e.target.value); setTouched(true) }}
              autoComplete="new-password"
            />
            <button type="button" className="input-reveal__btn" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {touched && (
            <ul className="password-rules">
              {rules.map(r => (
                <li key={r.key} className={`password-rule ${r.test(password) ? 'password-rule--pass' : 'password-rule--fail'}`}>
                  <span className="password-rule__icon">{r.test(password) ? '✓' : '✗'}</span>
                  {r.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="confirm_password">Confirm Password</label>
          <div className="input-reveal">
            <input
              id="confirm_password"
              name="confirm_password"
              type={showConfirm ? 'text' : 'password'}
              className="form-input"
              placeholder="••••••••"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
            <button type="button" className="input-reveal__btn" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
              {showConfirm ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {confirm && !passwordsMatch && (
            <p className="password-rule password-rule--fail" style={{ listStyle: 'none', margin: '4px 0 0' }}>
              <span className="password-rule__icon">✗</span> Passwords do not match
            </p>
          )}
          {confirm && passwordsMatch && (
            <p className="password-rule password-rule--pass" style={{ listStyle: 'none', margin: '4px 0 0' }}>
              <span className="password-rule__icon">✓</span> Passwords match
            </p>
          )}
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button
          type="submit"
          className="btn btn--primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
    </div>
  )
}
