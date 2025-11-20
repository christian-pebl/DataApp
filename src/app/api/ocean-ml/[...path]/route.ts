import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ocean-ML backend URL from environment variable
const OCEAN_ML_BACKEND_URL = process.env.OCEAN_ML_BACKEND_URL || 'http://localhost:8001'

/**
 * Proxy all requests to Ocean-ML backend
 * This allows the frontend to call /api/ocean-ml/* and have it forwarded to the Python backend
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'POST')
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'PUT')
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'DELETE')
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'PATCH')
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  try {
    // Get authentication token from Supabase session
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: 'Authentication failed', details: authError.message },
        { status: 401 }
      )
    }

    // Construct the target URL
    const path = pathSegments.join('/')
    const targetUrl = `${OCEAN_ML_BACKEND_URL}/api/${path}`

    // Get query parameters from the original request
    const searchParams = request.nextUrl.searchParams.toString()
    const fullUrl = searchParams ? `${targetUrl}?${searchParams}` : targetUrl

    console.log(`[Ocean-ML Proxy] ${method} ${fullUrl}`)

    // Prepare headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    // Add authorization header if session exists
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }

    // Prepare request options
    const options: RequestInit = {
      method,
      headers,
    }

    // Add body for POST/PUT/PATCH requests
    if (method !== 'GET' && method !== 'DELETE') {
      try {
        const body = await request.text()
        if (body) {
          options.body = body
        }
      } catch (e) {
        console.error('Error reading request body:', e)
      }
    }

    // Forward the request to Ocean-ML backend
    const response = await fetch(fullUrl, options)

    // Get response data
    const contentType = response.headers.get('content-type')
    let data

    if (contentType?.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    // Return the response from the backend
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    })

  } catch (error) {
    console.error('[Ocean-ML Proxy] Error:', error)

    return NextResponse.json(
      {
        error: 'Proxy error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: `Failed to connect to Ocean-ML backend at ${OCEAN_ML_BACKEND_URL}`,
      },
      { status: 500 }
    )
  }
}
