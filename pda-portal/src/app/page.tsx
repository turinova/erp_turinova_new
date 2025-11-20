import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { redirect } from 'next/navigation'

async function getUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('pda_token')?.value
  
  if (!token) {
    redirect('/login')
  }
  
  try {
    const secret = new TextEncoder().encode(process.env.PDA_JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch (error) {
    redirect('/login')
  }
}

export default async function HomePage() {
  const user = await getUser()
  
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Üdvözöljük a PDA rendszerben!
          </h1>
          <p className="text-gray-600">
            Bejelentkezve: <span className="font-semibold">{user.email as string}</span>
          </p>
          {user.fullName && (
            <p className="text-gray-600">
              Név: <span className="font-semibold">{user.fullName as string}</span>
            </p>
          )}
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Minta oldal
          </h2>
          <p className="text-gray-600 mb-4">
            Ez egy minta oldal a PIN bejelentkezés teszteléséhez.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">Funkció 1</h3>
              <p className="text-sm text-blue-700">Itt jön majd a POS funkció</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
              <h3 className="font-semibold text-green-900 mb-2">Funkció 2</h3>
              <p className="text-sm text-green-700">További funkciók...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

