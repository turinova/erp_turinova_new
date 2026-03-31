'use client'

import { useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase-client'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function BottomCTA() {
  const [demoName, setDemoName] = useState('')
  const [demoEmail, setDemoEmail] = useState('')
  const [demoPhone, setDemoPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (!demoName.trim()) { setError('A neve megadása kötelező.'); return }
    if (!emailPattern.test(demoEmail.trim())) { setError('Kérjük érvényes e-mail címet adjon meg.'); return }

    setSubmitting(true)
    try {
      const { error: dbError } = await supabase
        .from('demo_requests')
        .insert([{
          name: demoName.trim(),
          email: demoEmail.trim().toLowerCase(),
          phone: demoPhone.trim() || null,
          source: 'landing-v2-bottom-cta',
        }])

      if (dbError) {
        if (dbError.code === '23505') {
          setSubmitted(true)
        } else {
          setError('Hiba történt. Kérjük próbálja újra, vagy írjon a info@turinova.hu címre.')
        }
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Hiba történt. Kérjük próbálja újra.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="demo" className="relative bg-white py-16 overflow-hidden scroll-mt-16">
      {/* Warm background gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(251,146,60,0.10) 0%, transparent 70%)',
        }}
      />
      {/* Subtle dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #e2e8f0 1px, transparent 0)',
          backgroundSize: '32px 32px',
          opacity: 0.4,
        }}
      />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">

        {/* Eyebrow */}
        <span className="inline-flex items-center gap-2 rounded-full border border-orange-200/60 bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-600 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
          </span>
          Ingyenes demo · Nincs kötelezettség
        </span>

        {/* Headline */}
        <h2 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
          Láttad eleget?{' '}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)' }}
          >
            Foglald le a demót.
          </span>
        </h2>

        {/* Subtext */}
        <p className="mt-4 text-slate-500 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
          Visszahívunk 24 órán belül. Megmutatjuk, hogyan illik a Turinova
          a te webshopodba — konkrét példákkal, élőben.
        </p>

        {/* Trust indicators */}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {[
            { icon: '✓', text: 'Bevezethető 1 héten belül' },
            { icon: '✓', text: 'Magyar támogatás' },
            { icon: '✓', text: 'Nincs hosszú távú kötöttség' },
          ].map(({ icon, text }) => (
            <span key={text} className="inline-flex items-center gap-1.5 text-[13px] text-slate-500">
              <span className="text-emerald-500 font-bold">{icon}</span>
              {text}
            </span>
          ))}
        </div>

        {/* Form card */}
        <div className="mt-10 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-100/80 p-8 sm:p-10 text-left">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-xl font-bold text-slate-900">Köszönjük az érdeklődést!</p>
              <p className="text-sm text-slate-500">Hamarosan felvesszük Önnel a kapcsolatot.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-600" htmlFor="bottom-name">
                    Teljes név *
                  </label>
                  <input
                    id="bottom-name"
                    type="text"
                    value={demoName}
                    onChange={e => setDemoName(e.target.value)}
                    placeholder="Kovács János"
                    required
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-colors"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-600" htmlFor="bottom-email">
                    E-mail cím *
                  </label>
                  <input
                    id="bottom-email"
                    type="email"
                    value={demoEmail}
                    onChange={e => setDemoEmail(e.target.value)}
                    placeholder="pelda@webshop.hu"
                    required
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600" htmlFor="bottom-phone">
                  Telefonszám (opcionális)
                </label>
                <input
                  id="bottom-phone"
                  type="tel"
                  value={demoPhone}
                  onChange={e => setDemoPhone(e.target.value)}
                  placeholder="+36 30 999 2800"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-colors"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 w-full py-3.5 px-6 text-sm font-semibold text-white bg-orange-600 rounded-xl hover:bg-orange-700 active:bg-orange-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150 shadow-md shadow-orange-200"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Küldés...
                  </span>
                ) : 'Demo igénylése →'}
              </button>

              <p className="text-[11px] text-slate-400 text-center">
                A küldéssel elfogadja az{' '}
                <a href="/privacy-policy" className="underline hover:text-slate-600">adatvédelmi irányelveket</a>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
