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
      
      toast.success('Sikeres bejelentkezés!')
      router.push('/')
      
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      {/* Logo */}
      <div className="mb-8">
        <img 
          src="/images/turinova-logo.png" 
          alt="Turinova Logo" 
          className="h-16 w-auto object-contain"
          onError={(e) => {
            // Fallback if logo doesn't exist
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>
      
      {/* PIN Display */}
      <div className="mb-8">
        <div className="flex justify-center gap-3 mb-4">
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
      <div className="w-full max-w-xs">
        <div className="grid grid-cols-3 gap-4">
          {numbers.map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num)}
              disabled={isLoading || pin.length >= 6}
              className="aspect-square bg-white rounded-lg shadow-md active:shadow-sm active:scale-95 transition-all duration-75 text-3xl font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {num}
            </button>
          ))}
          
          {/* Backspace button */}
          <button
            onClick={handleBackspace}
            disabled={isLoading || pin.length === 0}
            className="aspect-square bg-white rounded-lg shadow-md active:shadow-sm active:scale-95 transition-all duration-75 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            <svg 
              className="w-8 h-8 text-gray-700" 
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
        <div className="mt-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      )}
    </div>
  )
}

