import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

// Path to the Ocean-ML backend
const OCEAN_ML_BACKEND_PATH = 'G:\\.shortcut-targets-by-id\\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\\Ocean\\08 - Data\\03 - Machine Learning\\Ocean-ML\\backend'

export async function POST() {
  try {
    // Check if backend is already running
    const backendUrl = process.env.OCEAN_ML_BACKEND_URL || 'http://localhost:8001'

    try {
      const healthCheck = await fetch(`${backendUrl}/health`, {
        signal: AbortSignal.timeout(2000)
      })

      if (healthCheck.ok) {
        return NextResponse.json(
          { message: 'Backend is already running', status: 'online' },
          { status: 200 }
        )
      }
    } catch (error) {
      // Backend not running, continue to start it
    }

    // Start the Python backend
    const pythonPath = path.join(OCEAN_ML_BACKEND_PATH, 'venv', 'Scripts', 'python.exe')
    const mainPath = path.join(OCEAN_ML_BACKEND_PATH, 'main.py')

    const backend = spawn(pythonPath, [mainPath], {
      cwd: OCEAN_ML_BACKEND_PATH,
      detached: true,
      stdio: 'ignore', // Don't pipe output to this process
      shell: false,
    })

    // Detach the process so it keeps running after this request completes
    backend.unref()

    return NextResponse.json(
      {
        message: 'Ocean-ML backend is starting',
        pid: backend.pid,
        status: 'starting',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error starting Ocean-ML backend:', error)

    return NextResponse.json(
      {
        error: 'Failed to start Ocean-ML backend',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
