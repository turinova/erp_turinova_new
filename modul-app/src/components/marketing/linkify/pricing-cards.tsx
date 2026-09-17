'use client'

import { CheckCircleIcon } from 'lucide-react'
import { useState } from 'react'

import { PLANS } from '@/lib/marketing/linkify/content'
import { cn } from '@/lib/utils'

type Tab = 'monthly' | 'yearly'

export function PricingCards() {
  const [activeTab, setActiveTab] = useState<Tab>('monthly')

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1">
        {(['monthly', 'yearly'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors',
              activeTab === tab
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-6 grid w-full max-w-5xl grid-cols-1 gap-5 pt-2 md:gap-8 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const price =
            activeTab === 'monthly' ? plan.price.monthly : plan.price.yearly
          return (
            <div
              key={plan.name}
              className={cn(
                'flex w-full flex-col rounded-xl border border-zinc-200 bg-white',
                plan.name === 'Pro' && 'border-2 border-red-500'
              )}
            >
              <div
                className={cn(
                  'border-b border-zinc-200 px-6 py-5',
                  plan.name === 'Pro' ? 'bg-red-500/[0.07]' : 'bg-zinc-50'
                )}
              >
                <h3
                  className={cn(
                    'text-lg font-medium',
                    plan.name !== 'Pro' && 'text-zinc-500'
                  )}
                >
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">{plan.info}</p>
                <p className="mt-3 text-3xl font-semibold text-zinc-900">
                  ${price}
                  <span className="text-base font-normal text-zinc-500">
                    {plan.name !== 'Free'
                      ? activeTab === 'monthly'
                        ? '/month'
                        : '/year'
                      : ''}
                  </span>
                </p>
              </div>
              <div className="flex-1 space-y-4 px-6 py-6">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-red-500" />
                    <p
                      className={cn(
                        'text-sm text-zinc-700',
                        feature.tooltip &&
                          'cursor-default border-b border-dashed border-zinc-300'
                      )}
                      title={feature.tooltip}
                    >
                      {feature.text}
                    </p>
                  </div>
                ))}
              </div>
              <div className="px-6 pb-6">
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-9 w-full cursor-default items-center justify-center rounded-md text-sm font-medium',
                    plan.btn.variant === 'purple'
                      ? 'bg-red-600 text-white'
                      : 'border border-zinc-200 bg-white text-zinc-900'
                  )}
                >
                  {plan.btn.text}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
