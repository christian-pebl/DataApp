import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUploadedVideos } from '@/lib/supabase/motion-analysis-service';
import { withTimeout, TIMEOUTS, API_ROUTE_CONFIG } from '@/lib/api-timeout';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = API_ROUTE_CONFIG.dynamic;
export const revalidate = API_ROUTE_CONFIG.revalidate;
export const maxDuration = API_ROUTE_CONFIG.maxDuration;

export async function GET(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log('[VIDEOS-API] Request started');

  try {
    // Step 1: Create client with timeout
    console.log('[VIDEOS-API] Creating Supabase client...');
    const supabase = await withTimeout(
      createClient(),
      TIMEOUTS.CLIENT_CREATION,
      'Supabase client creation'
    );
    console.log(`[VIDEOS-API] ✓ Client created (${Date.now() - requestStartTime}ms)`);

    // Step 2: Get user with timeout
    console.log('[VIDEOS-API] Getting authenticated user...');
    const { data: { user }, error: authError } = await withTimeout(
      supabase.auth.getUser(),
      TIMEOUTS.USER_AUTH,
      'User authentication'
    );

    if (authError || !user) {
      console.log(`[VIDEOS-API] ✗ Not authenticated (${Date.now() - requestStartTime}ms)`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[VIDEOS-API] ✓ User authenticated: ${user.email} (${Date.now() - requestStartTime}ms)`);

    // Step 3: Get videos from database with timeout
    console.log('[VIDEOS-API] Fetching videos from database...');
    const { videos, error } = await withTimeout(
      getUploadedVideos(supabase),
      TIMEOUTS.DATABASE_READ,
      'Database video fetch'
    );
    console.log(`[VIDEOS-API] ✓ Videos fetched: ${videos?.length || 0} videos (${Date.now() - requestStartTime}ms)`);

    if (error) {
      console.error(`[VIDEOS-API] ✗ Database error (${Date.now() - requestStartTime}ms):`, error);
      return NextResponse.json(
        { error: 'Failed to fetch videos', details: error.message },
        { status: 500 }
      );
    }

    // Step 4: Get processing runs with timeout
    console.log('[VIDEOS-API] Fetching processing runs...');
    const { data: processingRuns } = await withTimeout(
      supabase
        .from('processing_runs')
        .select('id, run_type, status, started_at, completed_at, video_ids, logs, videos_processed, videos_failed, total_videos')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false }),
      TIMEOUTS.DATABASE_READ,
      'Processing runs fetch'
    );
    console.log(`[VIDEOS-API] ✓ Processing runs fetched: ${processingRuns?.length || 0} runs (${Date.now() - requestStartTime}ms)`);

    // Create a map of video_id to processing history
    const videoHistory: Record<string, any[]> = {};
    if (processingRuns) {
      for (const run of processingRuns) {
        if (run.video_ids && Array.isArray(run.video_ids)) {
          for (const videoId of run.video_ids) {
            if (!videoHistory[videoId]) {
              videoHistory[videoId] = [];
            }
            videoHistory[videoId].push({
              run_id: run.id,
              run_type: run.run_type,
              status: run.status,
              started_at: run.started_at,
              completed_at: run.completed_at,
              logs: run.logs,
              videos_processed: run.videos_processed,
              videos_failed: run.videos_failed,
              total_videos: run.total_videos,
            });
          }
        }
      }
    }

    // Enrich with processing results (motion analysis JSON)
    const enrichedVideos = await Promise.all(
      (videos || []).map(async (video) => {
        const filenameStem = video.filename.replace('.mp4', '');

        // Try multiple possible paths for motion analysis JSON
        // Priority 1: Use the path from database if available (set by /complete endpoint)
        // Priority 2: New format: {filename_stem}/{filename_stem}_motion_analysis.json
        // Priority 3: Old format: {filename}_background_subtracted_motion_analysis.json
        const possibleMotionPaths = [
          // Path from database (relative to public/)
          video.motion_analysis ? path.join(process.cwd(), 'public', video.motion_analysis) : null,
          // New format: subdirectory structure
          path.join(process.cwd(), 'public', 'motion-analysis-results', filenameStem, `${filenameStem}_motion_analysis.json`),
          // Old format: flat structure
          path.join(process.cwd(), 'public', 'motion-analysis-results', `${filenameStem}_background_subtracted_motion_analysis.json`),
        ].filter(Boolean) as string[];

        // Path for YOLO JSON
        const yoloJsonPath = path.join(
          process.cwd(),
          'public',
          'motion-analysis-results',
          `${filenameStem}_yolov8.json`
        );

        let motionData = null;
        let yoloData = null;

        // Try each motion path until we find one that exists
        for (const motionPath of possibleMotionPaths) {
          try {
            const motionContent = await fs.readFile(motionPath, 'utf-8');
            motionData = JSON.parse(motionContent);
            break; // Found it, stop searching
          } catch {
            // Try next path
          }
        }

        if (!motionData && video.processing_status === 'completed') {
          console.warn(`⚠ Video ${video.filename} marked completed but motion analysis not found`);
        }

        try {
          const yoloContent = await fs.readFile(yoloJsonPath, 'utf-8');
          yoloData = JSON.parse(yoloContent);
        } catch {
          // YOLO analysis not yet available
        }

        return {
          ...video,
          // Include processing_status for UI classification
          processing_status: video.processing_status,
          motion_analysis: motionData,
          yolo_analysis: yoloData,
          processing_history: videoHistory[video.id] || [],
        };
      })
    );

    console.log(`[VIDEOS-API] ✓ Request completed successfully (${Date.now() - requestStartTime}ms)`);
    return NextResponse.json({ videos: enrichedVideos });

  } catch (error: any) {
    console.error(`[VIDEOS-API] ✗ Error after ${Date.now() - requestStartTime}ms:`, error);

    // Check if it's a timeout error
    if (error.message?.includes('timed out')) {
      return NextResponse.json(
        {
          error: 'Request timeout',
          details: error.message,
          suggestion: 'The database might be slow or unreachable. Please try again in a moment.',
        },
        { status: 504 } // Gateway Timeout
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}
