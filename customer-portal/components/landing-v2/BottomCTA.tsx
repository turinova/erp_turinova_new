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

    if (!demoName.trim()) {
      setError('A neve megadása kötelező.')
      return
    }
    if (!emailPattern.test(demoEmail.trim())) {
      setError('Kérjük érvényes e-mail címet adjon meg.')
      return
    }

    setSubmitting(true)
    try {
      const { error: dbError } = await supabase.from('demo_requests').insert([
        {
          name: demoName.trim(),
          email: demoEmail.trim().toLowerCase(),
          phone: demoPhone.trim() || null,
          source: 'landing-v2-bottom-cta',
        },
      ])

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
    <section id="demo" className="relative bg-white py-14 sm:py-16 border-t border-slate-200 scroll-mt-16">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {submitted ? (
          <div className="max-w-md mx-auto text-center py-4">
            <div className="rounded-xl border border-slate-200 bg-white p-8">
              <p className="text-xl font-bold text-slate-900">Megkaptuk.</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Egy munkanapon belül jelentkezünk.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
            <div className="text-center lg:text-left pt-1">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
                Visszahívás
              </h2>
              <p className="mt-4 text-slate-600 text-base sm:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
                Egy munkanapon belül felhívunk. Megbeszéljük, mire van szükséged.
              </p>
              <div className="mt-6 space-y-1 text-sm text-slate-600">
                <p>
                  <a className="hover:text-orange-700" href="mailto:info@turinova.hu">
                    info@turinova.hu
                  </a>
                </p>
                <p>
                  <a className="hover:text-orange-700" href="tel:+36309992800">
                    +36 30 999 2800
                  </a>
                </p>
              </div>
            </div>

            <div>
              <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 text-left">
                <p className="text-sm font-semibold text-slate-900 mb-1">Írj nekünk</p>
                <p className="text-xs text-slate-500 mb-6">Név és e-mail elég. A telefon opcionális.</p>

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
                        autoComplete="name"
                        className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-colors"
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
                        autoComplete="email"
                        className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-colors"
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
                      autoComplete="tel"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-colors"
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-1 w-full py-3 px-6 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Küldés...' : 'Küldés'}
                  </button>

                  <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                    A küldéssel elfogadod az{' '}
                    <a href="/adatkezeles" className="underline hover:text-slate-600">
                      adatkezelési tájékoztatót
                    </a>
                    .
                  </p>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
