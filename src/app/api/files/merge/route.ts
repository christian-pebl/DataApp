import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

/**
 * API Route for CSV File Merging
 *
 * Endpoint: POST /api/files/merge
 *
 * Actions:
 * - validate: Check if files can be merged (column compatibility, date overlaps)
 * - merge: Perform actual merge operation
 */

interface MergeRequest {
  action: 'validate' | 'merge'
  fileIds: string[]
  outputFileName?: string
  pinId?: string
  deduplicateStrategy?: 'exact' | 'none'
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  columnHeaders?: string[]
  dateRanges?: Array<{
    fileId: string
    fileName: string
    startDate: string | null
    endDate: string | null
  }>
  overlaps?: Array<{
    file1: string
    file2: string
    overlapStart: string
    overlapEnd: string
  }>
}

interface MergeResult {
  success: boolean
  mergedFileId?: string
  mergedFileName?: string
  rowCount?: number
  duplicatesRemoved?: number
  error?: string
}

interface FileMetadata {
  id: string
  file_name: string
  file_path: string
  pin_id: string
  start_date: string | null
  end_date: string | null
}

interface ParsedCSV {
  headers: string[]
  rows: string[][]
  dateColumnIndex: number
}

/**
 * Detect the date/time column from CSV headers
 * Looks for common patterns like 'time', 'date', 'timestamp', etc.
 */
function detectDateColumn(headers: string[]): number {
  const datePatterns = [
    'time',
    'timestamp',
    'datetime',
    'date_time',
    'date',
    'utc',
    'utc_time',
  ]

  // Try exact matches first (case-insensitive)
  for (const pattern of datePatterns) {
    const index = headers.findIndex(
      (h) => h.toLowerCase().trim() === pattern.toLowerCase()
    )
    if (index >= 0) return index
  }

  // Try partial matches
  for (const pattern of datePatterns) {
    const index = headers.findIndex((h) =>
      h.toLowerCase().includes(pattern.toLowerCase())
    )
    if (index >= 0) return index
  }

  // Default to first column if no date column found
  return 0
}

/**
 * Parse date string with multiple format support
 * Handles: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, ISO 8601
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null

  const cleanStr = dateStr.trim()

  // Try ISO 8601 formats first
  const isoFormats = [
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{3})?$/,
    /^\d{4}-\d{2}-\d{2}$/,
  ]

  for (const format of isoFormats) {
    if (format.test(cleanStr)) {
      const date = new Date(cleanStr)
      if (!isNaN(date.getTime())) return date
    }
  }

  // Try DD/MM/YYYY or MM/DD/YYYY formats
  const slashDateMatch = cleanStr.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/
  )
  if (slashDateMatch) {
    const [, d1, d2, year] = slashDateMatch
    const day1 = parseInt(d1, 10)
    const day2 = parseInt(d2, 10)

    // Heuristic: if first component > 12, it's DD/MM/YYYY
    if (day1 > 12) {
      const date = new Date(parseInt(year), parseInt(d2) - 1, day1)
      if (!isNaN(date.getTime())) return date
    }
    // If second component > 12, it's MM/DD/YYYY
    else if (day2 > 12) {
      const date = new Date(parseInt(year), day1 - 1, day2)
      if (!isNaN(date.getTime())) return date
    }
    // Ambiguous case - default to DD/MM/YYYY (European)
    else {
      const date = new Date(parseInt(year), parseInt(d2) - 1, day1)
      if (!isNaN(date.getTime())) return date
    }
  }

  // Fallback to native parsing (handles many formats)
  try {
    const date = new Date(cleanStr)
    if (!isNaN(date.getTime()) && date.getFullYear() >= 1970) {
      return date
    }
  } catch {
    // Parsing failed
  }

  return null
}

/**
 * Validate files for merging compatibility
 * Checks:
 * - All files exist and belong to same user
 * - Column headers match (case-insensitive, order-independent)
 * - Detects date overlaps between files
 */
async function validateFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fileIds: string[]
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    dateRanges: [],
    overlaps: [],
  }

  // Check minimum files
  if (fileIds.length < 2) {
    result.valid = false
    result.errors.push('At least 2 files are required for merging')
    return result
  }

  // Check maximum files
  if (fileIds.length > 100) {
    result.valid = false
    result.errors.push('Maximum 100 files can be merged at once')
    return result
  }

  // Fetch file metadata
  const { data: files, error: fetchError } = await supabase
    .from('pin_files')
    .select('id, file_name, file_path, pin_id, start_date, end_date')
    .in('id', fileIds)

  if (fetchError || !files) {
    result.valid = false
    result.errors.push('Failed to fetch file metadata: ' + fetchError?.message)
    return result
  }

  if (files.length !== fileIds.length) {
    result.valid = false
    result.errors.push(
      `Some files not found. Requested: ${fileIds.length}, Found: ${files.length}`
    )
    return result
  }

  const typedFiles = files as FileMetadata[]

  // Check all files belong to same pin
  const pinIds = new Set(typedFiles.map((f) => f.pin_id))
  if (pinIds.size > 1) {
    result.valid = false
    result.errors.push('All files must belong to the same pin')
    return result
  }

  // Download and parse first file to get headers
  const Papa = await import('papaparse');
  const firstFile = typedFiles[0]
  const { data: firstBlob, error: downloadError } = await supabase.storage
    .from('pin-files')
    .download(firstFile.file_path)

  if (downloadError || !firstBlob) {
    result.valid = false
    result.errors.push('Failed to download first file for validation')
    return result
  }

  const firstText = await firstBlob.text()
  const firstParsed = Papa.parse<string[]>(firstText, {
    header: false,
    skipEmptyLines: true,
  })

  if (firstParsed.errors.length > 0) {
    result.valid = false
    result.errors.push(
      `CSV parsing error in ${firstFile.file_name}: ${firstParsed.errors[0].message}`
    )
    return result
  }

  const referenceHeaders = firstParsed.data[0]?.map((h) =>
    h.trim().toLowerCase()
  )
  if (!referenceHeaders || referenceHeaders.length === 0) {
    result.valid = false
    result.errors.push('First file has no headers')
    return result
  }

  result.columnHeaders = firstParsed.data[0]

  // Validate remaining files have matching headers
  for (let i = 1; i < typedFiles.length; i++) {
    const file = typedFiles[i]
    const { data: blob, error: err } = await supabase.storage
      .from('pin-files')
      .download(file.file_path)

    if (err || !blob) {
      result.valid = false
      result.errors.push(`Failed to download ${file.file_name}`)
      continue
    }

    const text = await blob.text()
    const parsed = Papa.parse<string[]>(text, {
      header: false,
      skipEmptyLines: true,
    })

    if (parsed.errors.length > 0) {
      result.valid = false
      result.errors.push(
        `CSV parsing error in ${file.file_name}: ${parsed.errors[0].message}`
      )
      continue
    }

    const headers = parsed.data[0]?.map((h) => h.trim().toLowerCase())
    if (!headers || headers.length === 0) {
      result.valid = false
      result.errors.push(`${file.file_name} has no headers`)
      continue
    }

    // Check header compatibility (case-insensitive, order-independent)
    const headersMatch =
      headers.length === referenceHeaders.length &&
      headers.every((h) => referenceHeaders.includes(h)) &&
      referenceHeaders.every((h) => headers.includes(h))

    if (!headersMatch) {
      result.valid = false
      result.errors.push(
        `Column headers mismatch in ${file.file_name}. Expected: [${referenceHeaders.join(', ')}], Got: [${headers.join(', ')}]`
      )
    }
  }

  // Collect date ranges for overlap detection
  for (const file of typedFiles) {
    result.dateRanges!.push({
      fileId: file.id,
      fileName: file.file_name,
      startDate: file.start_date,
      endDate: file.end_date,
    })
  }

  // Detect date overlaps (only if dates are available)
  const filesWithDates = typedFiles.filter((f) => f.start_date && f.end_date)
  for (let i = 0; i < filesWithDates.length; i++) {
    for (let j = i + 1; j < filesWithDates.length; j++) {
      const file1 = filesWithDates[i]
      const file2 = filesWithDates[j]

      const start1 = new Date(file1.start_date!)
      const end1 = new Date(file1.end_date!)
      const start2 = new Date(file2.start_date!)
      const end2 = new Date(file2.end_date!)

      // Check for overlap: (start1 <= end2) AND (start2 <= end1)
      if (start1 <= end2 && start2 <= end1) {
        const overlapStart = start1 > start2 ? start1 : start2
        const overlapEnd = end1 < end2 ? end1 : end2

        result.overlaps!.push({
          file1: file1.file_name,
          file2: file2.file_name,
          overlapStart: overlapStart.toISOString().split('T')[0],
          overlapEnd: overlapEnd.toISOString().split('T')[0],
        })

        result.warnings.push(
          `Date overlap detected between "${file1.file_name}" and "${file2.file_name}" (${overlapStart.toISOString().split('T')[0]} to ${overlapEnd.toISOString().split('T')[0]})`
        )
      }
    }
  }

  return result
}

/**
 * Merge multiple CSV files into one
 * Process:
 * 1. Download all files
 * 2. Parse and combine data
 * 3. Remove exact duplicates
 * 4. Sort by date column
 * 5. Upload merged file
 * 6. Create database entry with is_merged flag
 */
async function mergeFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fileIds: string[],
  outputFileName: string,
  pinId: string,
  deduplicateStrategy: 'exact' | 'none' = 'exact'
): Promise<MergeResult> {
  try {
    // Fetch file metadata
    const { data: files, error: fetchError } = await supabase
      .from('pin_files')
      .select('id, file_name, file_path, pin_id')
      .in('id', fileIds)

    if (fetchError || !files) {
      return {
        success: false,
        error: 'Failed to fetch file metadata: ' + fetchError?.message,
      }
    }

    const typedFiles = files as FileMetadata[]

    // Download and parse all files
    const Papa = await import('papaparse');
    const allRows: string[][] = []
    let mergedHeaders: string[] = []
    let dateColumnIndex = 0

    for (const file of typedFiles) {
      const { data: blob, error: downloadError } = await supabase.storage
        .from('pin-files')
        .download(file.file_path)

      if (downloadError || !blob) {
        return {
          success: false,
          error: `Failed to download ${file.file_name}`,
        }
      }

      const text = await blob.text()
      const parsed = Papa.parse<string[]>(text, {
        header: false,
        skipEmptyLines: true,
      })

      if (parsed.errors.length > 0) {
        return {
          success: false,
          error: `CSV parsing error in ${file.file_name}: ${parsed.errors[0].message}`,
        }
      }

      // First file: capture headers and detect date column
      if (allRows.length === 0) {
        mergedHeaders = parsed.data[0]
        dateColumnIndex = detectDateColumn(mergedHeaders)
        // Skip header row for data
        allRows.push(...parsed.data.slice(1))
      } else {
        // Subsequent files: skip header, add data
        allRows.push(...parsed.data.slice(1))
      }
    }

    console.log(
      `[MERGE] Total rows before deduplication: ${allRows.length}, Date column index: ${dateColumnIndex}`
    )

    // Remove exact duplicates if requested
    let duplicatesRemoved = 0
    if (deduplicateStrategy === 'exact') {
      const uniqueRows = new Set<string>()
      const dedupedRows: string[][] = []

      for (const row of allRows) {
        const rowKey = row.join('|')
        if (!uniqueRows.has(rowKey)) {
          uniqueRows.add(rowKey)
          dedupedRows.push(row)
        } else {
          duplicatesRemoved++
        }
      }

      allRows.length = 0
      allRows.push(...dedupedRows)
    }

    console.log(
      `[MERGE] Rows after deduplication: ${allRows.length}, Duplicates removed: ${duplicatesRemoved}`
    )

    // Sort by date column if detected
    if (dateColumnIndex >= 0 && dateColumnIndex < mergedHeaders.length) {
      allRows.sort((a, b) => {
        const dateA = parseDate(a[dateColumnIndex])
        const dateB = parseDate(b[dateColumnIndex])

        if (!dateA && !dateB) return 0
        if (!dateA) return 1
        if (!dateB) return -1

        return dateA.getTime() - dateB.getTime()
      })

      console.log(`[MERGE] Rows sorted by date column: ${mergedHeaders[dateColumnIndex]}`)
    }

    // Calculate date range for merged file
    let startDate: string | null = null
    let endDate: string | null = null

    if (dateColumnIndex >= 0 && allRows.length > 0) {
      const dates = allRows
        .map((row) => parseDate(row[dateColumnIndex]))
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime())

      if (dates.length > 0) {
        startDate = dates[0].toISOString().split('T')[0]
        endDate = dates[dates.length - 1].toISOString().split('T')[0]
      }
    }

    // Create merged CSV content
    const mergedCSV = Papa.unparse({
      fields: mergedHeaders,
      data: allRows,
    })

    // Upload merged file to storage
    const mergedFileId = uuidv4()
    const fileExtension = 'csv'
    const filePath = `pins/${pinId}/${mergedFileId}.${fileExtension}`
    const mergedBlob = new Blob([mergedCSV], { type: 'text/csv' })

    const { error: uploadError } = await supabase.storage
      .from('pin-files')
      .upload(filePath, mergedBlob, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      return {
        success: false,
        error: `Failed to upload merged file: ${uploadError.message}`,
      }
    }

    console.log(`[MERGE] Merged file uploaded to: ${filePath}`)

    // Create database entry for merged file
    const { data: newFile, error: dbError } = await supabase
      .from('pin_files')
      .insert({
        pin_id: pinId,
        file_name: outputFileName,
        file_path: filePath,
        file_size: mergedBlob.size,
        file_type: 'text/csv',
        project_id: 'default',
        start_date: startDate,
        end_date: endDate,
      })
      .select()
      .single()

    if (dbError) {
      // Clean up uploaded file
      await supabase.storage.from('pin-files').remove([filePath])
      return {
        success: false,
        error: `Failed to create database entry: ${dbError.message}`,
      }
    }

    console.log(`[MERGE] Database entry created with ID: ${newFile.id}`)

    return {
      success: true,
      mergedFileId: newFile.id,
      mergedFileName: outputFileName,
      rowCount: allRows.length,
      duplicatesRemoved,
    }
  } catch (error) {
    console.error('[MERGE] Unexpected error:', error)
    return {
      success: false,
      error: `Unexpected error during merge: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * POST handler for file merge API
 */
export async function POST(request: NextRequest) {
  try {
    // Create Supabase client with server-side auth
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = (await request.json()) as MergeRequest

    // Validate request
    if (!body.action || !['validate', 'merge'].includes(body.action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "validate" or "merge"' },
        { status: 400 }
      )
    }

    if (!body.fileIds || !Array.isArray(body.fileIds) || body.fileIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 file IDs are required' },
        { status: 400 }
      )
    }

    if (body.fileIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 files can be merged at once' },
        { status: 400 }
      )
    }

    // Handle validation action
    if (body.action === 'validate') {
      const validationResult = await validateFiles(supabase, body.fileIds)
      return NextResponse.json(validationResult)
    }

    // Handle merge action
    if (body.action === 'merge') {
      // Validate first
      const validationResult = await validateFiles(supabase, body.fileIds)
      if (!validationResult.valid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            validationErrors: validationResult.errors,
          },
          { status: 400 }
        )
      }

      // Check required fields for merge
      if (!body.outputFileName) {
        return NextResponse.json(
          { error: 'outputFileName is required for merge action' },
          { status: 400 }
        )
      }

      if (!body.pinId) {
        return NextResponse.json(
          { error: 'pinId is required for merge action' },
          { status: 400 }
        )
      }

      // Perform merge
      const mergeResult = await mergeFiles(
        supabase,
        body.fileIds,
        body.outputFileName,
        body.pinId,
        body.deduplicateStrategy || 'exact'
      )

      if (mergeResult.success) {
        return NextResponse.json(mergeResult, { status: 200 })
      } else {
        return NextResponse.json(mergeResult, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[API] Merge endpoint error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
