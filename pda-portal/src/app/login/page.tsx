'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'

export default function PDALoginPage() {
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const autoSubmitRef = useRef(false)
  
  const handleNumberClick = (num: number) => {
    if (pin.length < 6 && !isLoading) {
      const newPin = pin + num.toString()
      setPin(newPin)
    }
  }
  
  const handleBackspace = () => {
    if (pin.length > 0 && !isLoading) {
      setPin(pin.slice(0, -1))
    }
  }
  
  const handleClear = () => {
    if (!isLoading) {
      setPin('')
    }
  }
  
  const handleSubmit = useCallback(async () => {
    if (pin.length !== 6 || isLoading) {
      if (pin.length !== 6) {
        toast.error('Adjon meg 6 számjegyet')
      }
      return
    }
    
    setIsLoading(true)
    autoSubmitRef.current = true
    
    try {
      const response = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        const errorMessage = data.details || data.error || 'Hibás PIN'
        toast.error(errorMessage)
        setPin('')
        return
      }
      
      // Set flag to prevent auto-logout on main page
      sessionStorage.setItem('pda_just_logged_in', 'true')
      // Use window.location.href instead of router.push to ensure cookie is available
      // This forces a full page reload which ensures the cookie is sent with the request
      window.location.href = '/'
      
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Hiba történt a bejelentkezés során')
      setPin('')
    } finally {
      setIsLoading(false)
      autoSubmitRef.current = false
    }
  }, [pin, isLoading, router])
  
  // Auto-submit when pin reaches 6 digits
  useEffect(() => {
    if (pin.length === 6 && !isLoading && !autoSubmitRef.current) {
      const timer = setTimeout(() => {
        handleSubmit()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [pin, isLoading, handleSubmit])
  
  // PIN pad numbers 1-9
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  
  return (
    <div className="h-[100dvh] overflow-hidden bg-gray-100 px-4 py-3">
      <div className="mx-auto flex h-full w-full max-w-xs flex-col">
      {/* Logo */}
      <div className="flex-shrink-0 py-1">
        <img 
          src="/images/turinova-logo.png" 
          alt="Turinova Logo" 
          className="mx-auto h-10 w-auto object-contain sm:h-12"
          onError={(e) => {
            // Fallback if logo doesn't exist
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>

      {/* Ellenörzés button */}
      <div className="w-full flex-shrink-0 py-1">
        <button
          onClick={() => router.push('/check')}
          disabled={isLoading}
          className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-base font-semibold text-white shadow-md transition-all active:scale-95 active:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
        >
          Ellenőrzés
        </button>
      </div>
      
      {/* PIN Display */}
      <div className="flex-shrink-0 py-2">
        <div className="mb-2 flex justify-center gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                i < pin.length
                  ? 'bg-blue-600 scale-110'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
        {pin.length > 0 && (
          <div className="text-center">
            <button
              onClick={handleClear}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
              disabled={isLoading}
            >
              Törlés
            </button>
          </div>
        )}
      </div>
      
      {/* PIN Pad */}
      <div className="flex min-h-0 flex-1 items-end py-1">
        <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
          {numbers.map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num)}
              disabled={isLoading || pin.length >= 6}
              className="aspect-square rounded-lg bg-white text-2xl font-semibold text-gray-800 shadow-md transition-all duration-75 active:scale-95 active:shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation sm:text-3xl"
            >
              {num}
            </button>
          ))}
          
          {/* Empty spacer to keep 0 centered */}
          <div className="aspect-square" aria-hidden="true" />

          {/* 0 button */}
          <button
            onClick={() => handleNumberClick(0)}
            disabled={isLoading || pin.length >= 6}
            className="aspect-square rounded-lg bg-white text-2xl font-semibold text-gray-800 shadow-md transition-all duration-75 active:scale-95 active:shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation sm:text-3xl"
            aria-label="0"
          >
            0
          </button>

          {/* Backspace button */}
          <button
            onClick={handleBackspace}
            disabled={isLoading || pin.length === 0}
            className="aspect-square flex items-center justify-center rounded-lg bg-white shadow-md transition-all duration-75 active:scale-95 active:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
          >
            <svg 
              className="h-7 w-7 text-gray-700 sm:h-8 sm:w-8" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" 
              />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="flex-shrink-0 py-1">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      )}
      </div>
    </div>
  )
}

