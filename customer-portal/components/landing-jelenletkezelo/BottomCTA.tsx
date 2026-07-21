'use client'

import type { FormEvent } from 'react';
import { useState } from 'react'

import Link from 'next/link'

import { supabase } from '@/lib/supabase-client'

/**
 * Jelenlétkezelő — BottomCTA
 *
 * Mirrors /v2 BottomCTA's shape and DB contract (demo_requests table),
 * but with attendance-specific trust points and the ROI hook as the main
 * emotional anchor ("2M+ Ft / év").
 *
 * `source = 'landing-jelenletkezelo-bottom-cta'` — lets us track conversion
 * differently from the webshop landing.
 */

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const trustPoints = [
  'Valós idejű jelenlét: RFID kártya vagy PIN a beléptető terminálon. A belépés után 1 mp-en belül látod a dashboardon.',
  'A túlórát és a korai távozást a rendszer számolja percre pontosan, dolgozónként saját szabállyal.',
  'A beléptető terminál havi díjban, telepítéssel és karbantartással együtt. Nem kell új gép, nem kell IT csapat.',
] as const

export default function BottomCTA() {
  const [demoName, setDemoName] = useState('')
  const [demoEmail, setDemoEmail] = useState('')
  const [demoPhone, setDemoPhone] = useState('')
  const [demoEmployees, setDemoEmployees] = useState('')
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
      // Encode the employee count into the source string so we capture the
      // signal without requiring an extra schema column. Format:
      // `landing-jelenletkezelo-bottom-cta|employees=15`
      const sourceTag = demoEmployees.trim()
        ? `landing-jelenletkezelo-bottom-cta|employees=${demoEmployees.trim()}`
        : 'landing-jelenletkezelo-bottom-cta'

      const { error: dbError } = await supabase.from('demo_requests').insert([
        {
          name: demoName.trim(),
          email: demoEmail.trim().toLowerCase(),
          phone: demoPhone.trim() || null,
          source: sourceTag,
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
    <section id="demo" className="relative bg-white py-12 sm:py-16 overflow-hidden scroll-mt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(37,99,235,0.12) 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(24,24,27,0.045) 1px, transparent 0)',
          backgroundSize: '36px 36px',
          opacity: 0.5,
        }}
      />

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 xl:px-14">
        {submitted ? (
          <div className="max-w-md mx-auto text-center py-4">
            <div
              className="rounded-3xl bg-white p-10"
              style={{
                border: '1px solid #E4E4E7',
                boxShadow: '0 30px 70px rgba(24,24,27,0.08), 0 4px 12px rgba(24,24,27,0.04)',
              }}
            >
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <p className="mt-5 text-xl font-bold" style={{ color: '#18181B' }}>
                Köszönjük, megkaptuk az adataidat.
              </p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: '#71717A' }}>
                1 munkanapon belül felvesszük veled a kapcsolatot, és egyeztetünk egy 20 perces hívást vagy online bemutatót.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 xl:gap-16 items-start">
            {/* Left: value prop */}
            <div className="text-center lg:text-left pt-1">
              <div className="flex justify-center lg:justify-start">
                <span
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest shadow-sm"
                  style={{ border: '1px solid #BFDBFE', color: '#1D4ED8' }}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                  </span>
                  Ingyenes bemutató · 20 perc · Kötelezettség nélkül
                </span>
              </div>

              <h2
                className="mt-6 text-3xl sm:text-4xl lg:text-[2.5rem] xl:text-[3.25rem] font-extrabold tracking-tight leading-[1.08]"
                style={{ color: '#18181B' }}
              >
                Nézd meg 20 percben, hogyan nyersz vissza{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 60%, #1D4ED8 100%)' }}
                >
                  2+ millió Ft-ot évente
                </span>{' '}
                a láthatatlan munkaóra-veszteségből.
              </h2>

              <p className="mt-5 text-base sm:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0" style={{ color: '#52525B' }}>
                Visszahívunk <strong style={{ color: '#3F3F46', fontWeight: 600 }}>1 munkanapon belül</strong>. Megmutatjuk a terminált működés közben, a dashboardot, a havi jelenléti ívet, és a saját céged számával kiszámoljuk, mennyit spórolsz havonta.
              </p>

              <ul className="mt-8 space-y-3 max-w-xl mx-auto lg:mx-0 text-left">
                {trustPoints.map(text => (
                  <li key={text} className="flex gap-3 text-sm sm:text-[15px] leading-snug" style={{ color: '#3F3F46' }}>
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ background: '#DBEAFE', color: '#1D4ED8' }}
                      aria-hidden
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: form */}
            <div className="lg:sticky lg:top-28">
              <div
                className="bg-white rounded-3xl p-8 sm:p-10 text-left"
                style={{
                  border: '1px solid #E4E4E7',
                  boxShadow: '0 30px 70px rgba(24,24,27,0.08), 0 4px 12px rgba(24,24,27,0.04)',
                }}
              >
                <p className="text-sm font-semibold mb-1" style={{ color: '#18181B' }}>
                  Kérd a bemutatót
                </p>
                <p className="text-xs mb-6" style={{ color: '#71717A' }}>
                  Név és e-mail elég a visszajelzéshez. A dolgozók száma segít, hogy konkrét számokkal tudjunk készülni.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-zinc-600" htmlFor="att-name">
                        Teljes név *
                      </label>
                      <input
                        id="att-name"
                        type="text"
                        value={demoName}
                        onChange={e => setDemoName(e.target.value)}
                        placeholder="Kovács János"
                        required
                        autoComplete="name"
                        className="w-full px-3.5 py-2.5 text-sm text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-xl placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-zinc-600" htmlFor="att-email">
                        E-mail cím *
                      </label>
                      <input
                        id="att-email"
                        type="email"
                        value={demoEmail}
                        onChange={e => setDemoEmail(e.target.value)}
                        placeholder="pelda@ceg.hu"
                        required
                        autoComplete="email"
                        className="w-full px-3.5 py-2.5 text-sm text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-xl placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-zinc-600" htmlFor="att-phone">
                        Telefonszám (opcionális)
                      </label>
                      <input
                        id="att-phone"
                        type="tel"
                        value={demoPhone}
                        onChange={e => setDemoPhone(e.target.value)}
                        placeholder="+36 30 999 2800"
                        autoComplete="tel"
                        className="w-full px-3.5 py-2.5 text-sm text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-xl placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-zinc-600" htmlFor="att-employees">
                        Dolgozók száma
                      </label>
                      <input
                        id="att-employees"
                        type="text"
                        inputMode="numeric"
                        value={demoEmployees}
                        onChange={e => setDemoEmployees(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="pl. 15"
                        className="w-full px-3.5 py-2.5 text-sm text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-xl placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                  )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="mt-1 w-full py-3.5 px-6 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
                      style={{ boxShadow: '0 10px 24px rgba(37,99,235,0.35), 0 2px 6px rgba(37,99,235,0.2)' }}
                    >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Küldés...
                      </span>
                    ) : (
                      '20 perces bemutatót kérek →'
                    )}
                  </button>

                  <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
                    A küldéssel elfogadja az{' '}
                    <Link href="/privacy-policy" className="underline hover:text-zinc-600">
                      adatvédelmi irányelveket
                    </Link>
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
