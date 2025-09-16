import { NextRequest, NextResponse } from 'next/server'

// Simple static permission system - no database calls
const PAGES = [
  { id: '1', path: '/home', name: 'Főoldal', description: 'Rendszer főoldala', category: 'Általános' },
  { id: '2', path: '/company', name: 'Cégadatok', description: 'Cégadatok kezelése', category: 'Törzsadatok' },
  { id: '3', path: '/customers', name: 'Ügyfelek', description: 'Ügyfelek kezelése', category: 'Törzsadatok' },
  { id: '4', path: '/vat', name: 'Adónemek', description: 'Adónemek kezelése', category: 'Törzsadatok' },
  { id: '5', path: '/users', name: 'Felhasználók', description: 'Felhasználók kezelése', category: 'Rendszer' },
  { id: '6', path: '/opti', name: 'Optimalizáló', description: 'Optimalizáló eszköz', category: 'Eszközök' },
  { id: '7', path: '/optimalizalo', name: 'Optimalizáló', description: 'Optimalizáló eszköz', category: 'Eszközök' },
  { id: '8', path: '/brands', name: 'Márkák', description: 'Márkák kezelése', category: 'Törzsadatok' },
  { id: '9', path: '/currencies', name: 'Pénznemek', description: 'Pénznemek kezelése', category: 'Törzsadatok' },
  { id: '10', path: '/units', name: 'Mértékegységek', description: 'Mértékegységek kezelése', category: 'Törzsadatok' },
  { id: '11', path: '/materials', name: 'Táblás anyagok', description: 'Táblás anyagok kezelése', category: 'Anyagok' },
  { id: '12', path: '/szalas-anyagok', name: 'Szálas anyagok', description: 'Szálas anyagok kezelése', category: 'Anyagok' },
  { id: '13', path: '/edge', name: 'Elzárók', description: 'Elzárók kezelése', category: 'Anyagok' },
  { id: '14', path: '/opti-beallitasok', name: 'Opti beállítások', description: 'Optimalizáló beállítások', category: 'Eszközök' }
]

export async function GET(request: NextRequest) {
  return NextResponse.json({ pages: PAGES })
}
