import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { spawn, exec } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * POST /api/motion-analysis/process/start
 * Start a batch video processing run
 *
 * Request body:
 *   {
 *     videoIds: string[],           // Array of uploaded_videos IDs to process
 *     runType: 'local' | 'modal-t4' | 'modal-a10g',
 *     settings?: {
 *       targetFps: 'all' | '15' | '10' | '5',
 *       enableMotionAnalysis: boolean,
 *       enableYolo: boolean,
 *       yoloModel: 'yolov8n' | 'yolov8m' | 'yolov8l'
 *     }
 *   }
 *
 * Response:
 *   {
 *     success: boolean,
 *     runId: string,               // Processing run ID for tracking
 *     message: string
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { videoIds, runType, settings } = body;

    // Default settings
    const processingSettings = {
      targetFps: settings?.targetFps || '10',
      enableMotionAnalysis: settings?.enableMotionAnalysis ?? true,
      enableYolo: settings?.enableYolo ?? true,
      yoloModel: settings?.yoloModel || 'yolov8m',

      // Crab detection settings
      enableCrabDetection: settings?.enableCrabDetection ?? false,
      crabDetectionPreset: settings?.crabDetectionPreset || 'balanced',
      crabDetectionParams: settings?.crabDetectionParams || null,
    };

    // Validate input
    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No videos provided' },
        { status: 400 }
      );
    }

    if (!['local', 'modal-t4', 'modal-a10g'].includes(runType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid run type' },
        { status: 400 }
      );
    }

    // Check authentication (optional - depends on your auth setup)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id || null;

    // Fetch video details
    console.log('Fetching videos for IDs:', videoIds);
    const { data: videos, error: videosError } = await supabase
      .from('uploaded_videos')
      .select('id, filename, width, height, fps, duration_seconds, total_frames, processing_status')
      .in('id', videoIds);

    console.log('Fetch result:', { videos, error: videosError });

    if (videosError) {
      console.error('Supabase error fetching videos:', videosError);
      return NextResponse.json(
        { success: false, error: `Database error: ${videosError.message}` },
        { status: 500 }
      );
    }

    if (!videos || videos.length === 0) {
      console.error('No videos found for IDs:', videoIds);
      return NextResponse.json(
        { success: false, error: `No videos found with provided IDs` },
        { status: 404 }
      );
    }

    // Filter out already completed videos (unless explicitly reprocessing)
    const pendingVideos = videos.filter(v => v.processing_status !== 'completed');
    const alreadyCompleted = videos.filter(v => v.processing_status === 'completed');

    if (alreadyCompleted.length > 0) {
      console.log(`Skipping ${alreadyCompleted.length} already completed videos:`, alreadyCompleted.map(v => v.filename));
    }

    if (pendingVideos.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'All selected videos have already been processed',
        alreadyCompleted: alreadyCompleted.length
      }, { status: 400 });
    }

    console.log(`Processing ${pendingVideos.length} videos (${alreadyCompleted.length} already completed)`);

    // Mark pending videos as "processing"
    const pendingVideoIds = pendingVideos.map(v => v.id);
    const { error: markProcessingError } = await supabase
      .from('uploaded_videos')
      .update({ processing_status: 'processing', updated_at: new Date().toISOString() })
      .in('id', pendingVideoIds);

    if (markProcessingError) {
      console.error('Error marking videos as processing:', markProcessingError);
      // Non-fatal - continue anyway
    }

    // Create processing run record
    const runId = randomUUID();
    const { error: runInsertError } = await supabase.from('processing_runs').insert({
      id: runId,
      user_id: userId,
      run_type: runType,
      total_videos: pendingVideos.length,
      videos_processed: 0,
      videos_failed: 0,
      video_ids: pendingVideoIds,
      status: 'running',
      started_at: new Date().toISOString(),
    });

    if (runInsertError) {
      console.error('Error creating processing run:', runInsertError);
      return NextResponse.json(
        { success: false, error: 'Failed to create processing run' },
        { status: 500 }
      );
    }

    // Prepare video info for Python script (only pending videos)
    const videoInfo = pendingVideos.map((v) => ({
      video_id: v.id,
      filename: v.filename,
      filepath: `public/videos/${v.filename}`,  // Derived from filename
      width: v.width,
      height: v.height,
      fps: v.fps,
      duration_seconds: v.duration_seconds,
      total_frames: v.total_frames,
    }));

    // Get the project root directory
    const projectRoot = process.cwd();
    const logFile = path.join(projectRoot, `processing-${runId}.log`);
    const apiUrl = `http://localhost:${process.env.PORT || 9002}`;

    // Escape JSON for command line - double-escape quotes for Windows
    const videosJson = JSON.stringify(videoInfo).replace(/"/g, '\\"');

    // Build the command - use shell for better Windows compatibility
    // Use -u flag for unbuffered output so logs appear in real-time
    const settingsJson = JSON.stringify(processingSettings).replace(/"/g, '\\"');
    const pythonCmd = `python -u batch_process_videos.py --run-id "${runId}" --run-type "${runType}" --videos "${videosJson}" --api-url "${apiUrl}" --settings "${settingsJson}"`;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Starting processing run: ${runId}`);
    console.log(`Run type: ${runType}`);
    console.log(`Settings:`, processingSettings);
    console.log(`Videos to process: ${pendingVideos.length} (${alreadyCompleted.length} already completed)`);
    console.log(`Log file: ${logFile}`);
    console.log(`${'='.repeat(80)}\n`);

    // Write initial log entry
    const timestamp = new Date().toISOString();
    fs.writeFileSync(logFile, `[${timestamp}] Starting processing run ${runId}\n`);
    fs.appendFileSync(logFile, `[${timestamp}] Run type: ${runType}\n`);
    fs.appendFileSync(logFile, `[${timestamp}] Videos to process: ${pendingVideos.length} (${alreadyCompleted.length} already completed)\n`);
    fs.appendFileSync(logFile, `[${timestamp}] Command: ${pythonCmd}\n\n`);

    // Use exec for better Windows shell compatibility
    const childProcess = exec(pythonCmd, {
      cwd: projectRoot,
      windowsHide: true,
    }, (error) => {
      // This callback runs when process completes
      // NOTE: stdout/stderr are already streamed in real-time below, so we only log errors here
      const endTimestamp = new Date().toISOString();
      if (error) {
        fs.appendFileSync(logFile, `\n[${endTimestamp}] [ERROR] Process error: ${error.message}\n`);
        fs.appendFileSync(logFile, `[${endTimestamp}] [ERROR] Exit code: ${error.code}\n`);
        console.error(`Processing run ${runId} failed:`, error.message);
      }
      fs.appendFileSync(logFile, `\n[${endTimestamp}] Process completed\n`);
    });

    // Log spawn errors immediately
    childProcess.on('error', (err) => {
      const errTimestamp = new Date().toISOString();
      fs.appendFileSync(logFile, `[${errTimestamp}] [SPAWN ERROR] ${err.message}\n`);
      console.error(`Failed to spawn process for run ${runId}:`, err);
    });

    // Stream stdout to log file in real-time
    childProcess.stdout?.on('data', (data) => {
      fs.appendFileSync(logFile, data.toString());
    });

    // Stream stderr to log file in real-time
    childProcess.stderr?.on('data', (data) => {
      fs.appendFileSync(logFile, `[STDERR] ${data.toString()}`);
    });

    console.log(`✓ Started processing run: ${runId}`);
    console.log(`  Process PID: ${childProcess.pid}`);

    // Store the PID in the database for cancellation support
    if (childProcess.pid) {
      const { error: pidUpdateError } = await supabase
        .from('processing_runs')
        .update({ process_pid: childProcess.pid })
        .eq('id', runId);

      if (pidUpdateError) {
        console.warn(`Warning: Failed to store PID for run ${runId}:`, pidUpdateError);
        // Non-fatal, continue
      } else {
        console.log(`  ✓ Stored PID ${childProcess.pid} for cancellation support`);
      }
    }

    return NextResponse.json({
      success: true,
      runId,
      message: `Started processing ${pendingVideos.length} video(s)${alreadyCompleted.length > 0 ? ` (${alreadyCompleted.length} already completed)` : ''}`,
      logFile: `processing-${runId}.log`,
      videosToProcess: pendingVideos.length,
      alreadyCompleted: alreadyCompleted.length,
    });
  } catch (error: any) {
    console.error('Error starting processing:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start processing' },
      { status: 500 }
    );
  }
}
