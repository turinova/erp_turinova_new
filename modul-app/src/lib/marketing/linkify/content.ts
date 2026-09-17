import {
  BarChart3Icon,
  FolderOpenIcon,
  WandSparklesIcon
} from 'lucide-react'

import { LINKIFY_ASSET } from '@/lib/marketing/linkify/paths'

/** Partner marketing top nav — flat, certainty-first. */
export const MARKETING_NAV = [
  { title: 'Hogyan működik', href: '/hogyan-mukodik' },
  { title: 'A történetünk', href: '/a-tortenetunk' },
  { title: 'Árak', href: '/arak' },
  { title: 'Kapcsolat', href: '/kapcsolat' }
] as const

/** @deprecated alias — Linkify navbar */
export const NAV_LINKS = MARKETING_NAV

export const COMPANIES = [
  { name: 'Asana', logo: LINKIFY_ASSET('company-01.svg') },
  { name: 'Tidal', logo: LINKIFY_ASSET('company-02.svg') },
  { name: 'Innovaccer', logo: LINKIFY_ASSET('company-03.svg') },
  { name: 'Linear', logo: LINKIFY_ASSET('company-04.svg') },
  { name: 'Raycast', logo: LINKIFY_ASSET('company-05.svg') },
  { name: 'Labelbox', logo: LINKIFY_ASSET('company-06.svg') }
] as const

export const PROCESS = [
  {
    title: 'Organize Your Links',
    description:
      'Efficiently categorize and tag your links for quick access and easy management.',
    icon: FolderOpenIcon
  },
  {
    title: 'Shorten and Customize',
    description: 'Create concise, branded links that are easy to share and track.',
    icon: WandSparklesIcon
  },
  {
    title: 'Analyze and Optimize',
    description:
      'Gain insights into link performance and optimize for better engagement.',
    icon: BarChart3Icon
  }
] as const

export const REVIEWS = [
  {
    name: 'Michael Smith',
    username: '@michaelsmith',
    rating: 5,
    review:
      'This tool is a lifesaver! Managing and tracking my links has never been easier. A must-have for anyone dealing with numerous links.'
  },
  {
    name: 'Emily Johnson',
    username: '@emilyjohnson',
    rating: 4,
    review:
      'Very useful app! It has streamlined my workflow considerably. A few minor bugs, but overall a great experience.'
  },
  {
    name: 'Daniel Williams',
    username: '@danielwilliams',
    rating: 5,
    review:
      "I've been using this app daily for months. The insights and analytics it provides are invaluable. Highly recommend it!"
  },
  {
    name: 'Sophia Brown',
    username: '@sophiabrown',
    rating: 4,
    review:
      'This app is fantastic! It offers everything I need to manage my links efficiently.'
  },
  {
    name: 'James Taylor',
    username: '@jamestaylor',
    rating: 5,
    review:
      "Absolutely love this app! It's intuitive and feature-rich. Has significantly improved how I manage and track links."
  },
  {
    name: 'Olivia Martinez',
    username: '@oliviamartinez',
    rating: 4,
    review:
      'Great app with a lot of potential. It has already saved me a lot of time. Looking forward to future updates and improvements.'
  },
  {
    name: 'William Garcia',
    username: '@williamgarcia',
    rating: 5,
    review:
      "This app is a game-changer for link management. It's easy to use, extremely powerful and highly recommended!"
  },
  {
    name: 'Mia Rodriguez',
    username: '@miarodriguez',
    rating: 4,
    review:
      "I've tried several link management tools, but this one stands out. It's simple, effective."
  },
  {
    name: 'Henry Lee',
    username: '@henrylee',
    rating: 5,
    review:
      "This app has transformed my workflow. Managing and analyzing links is now a breeze. I can't imagine working without it."
  }
] as const

export const PLANS = [
  {
    name: 'Free',
    info: 'For most individuals',
    price: { monthly: 0, yearly: 0 },
    features: [
      { text: 'Shorten links' },
      { text: 'Up to 100 tags', limit: '100 tags' },
      { text: 'Customizable branded links' },
      { text: 'Track clicks', tooltip: '1K clicks/month' },
      {
        text: 'Community support',
        tooltip: 'Get answers your questions on discord'
      },
      {
        text: 'AI powered suggestions',
        tooltip: 'Get up to 100 AI powered suggestions'
      }
    ],
    btn: { text: 'Start for free', variant: 'default' as const }
  },
  {
    name: 'Pro',
    info: 'For small businesses',
    price: { monthly: 9, yearly: 90 },
    features: [
      { text: 'Shorten links' },
      { text: 'Up to 500 tags', limit: '500 tags' },
      { text: 'Customizable branded links' },
      { text: 'Track clicks', tooltip: '20K clicks/month' },
      { text: 'Export click data', tooltip: 'Upto 1K links' },
      { text: 'Priority support', tooltip: 'Get 24/7 chat support' },
      {
        text: 'AI powered suggestions',
        tooltip: 'Get up to 500 AI powered suggestions'
      }
    ],
    btn: { text: 'Ingyenes konzultáció', variant: 'purple' as const }
  },
  {
    name: 'Business',
    info: 'For large organizations',
    price: { monthly: 49, yearly: 490 },
    features: [
      { text: 'Shorten links' },
      { text: 'Unlimited tags' },
      { text: 'Customizable branded links' },
      { text: 'Track clicks', tooltip: 'Unlimited clicks' },
      { text: 'Export click data', tooltip: 'Unlimited clicks' },
      {
        text: 'Dedicated manager',
        tooltip: 'Get priority support from our team'
      },
      {
        text: 'AI powered suggestions',
        tooltip: 'Get unlimited AI powered suggestions'
      }
    ],
    btn: { text: 'Contact team', variant: 'default' as const }
  }
]
