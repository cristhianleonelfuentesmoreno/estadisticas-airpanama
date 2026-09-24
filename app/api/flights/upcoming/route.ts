import { NextResponse, type NextRequest } from 'next/server'
import { getUpcomingFlights } from '@/app/actions/flights'

// Lectura de vuelos del itinerario para los paneles del navegador. Es una ruta (y no una
// Server Action) porque Next.js ejecuta las Server Actions de a una por cliente: usarlas
// para leer datos hacía esperar a la navegación y a otros pedidos.
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? undefined
  if (date && date !== 'TODOS' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
  }
  try {
    // getUpcomingFlights verifica que haya un usuario aprobado
    const flights = await getUpcomingFlights(date)
    return NextResponse.json(flights, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
}
