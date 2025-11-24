@echo off
REM Re-encode Motion Analysis Videos for Web Compatibility
REM Windows Batch Script Version

echo ==================================
echo Motion Video Re-encoding Script
echo ==================================
echo.

REM Check if ffmpeg is installed
where ffmpeg >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: ffmpeg is not installed
    echo.
    echo Please install ffmpeg first:
    echo   Windows: choco install ffmpeg
    echo   Or download from: https://www.gyan.dev/ffmpeg/builds/
    echo.
    pause
    exit /b 1
)

echo FFmpeg found
echo.

REM Navigate to videos directory
cd public\videos
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Could not find public\videos directory
    pause
    exit /b 1
)

REM Create backup directory
if not exist backup mkdir backup
echo Created backup directory
echo.

REM Counter
set /a total=10
set /a current=0

echo Found %total% videos to re-encode
echo.

REM Process each video
call :process_video "SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4"
call :process_video "SUBCAM_ALG_2020-01-27_12-00-40_background_subtracted.mp4"
call :process_video "SUBCAM_ALG_2020-01-29_09-00-40_background_subtracted.mp4"
call :process_video "SUBCAM_ALG_2020-02-01_09-00-41_background_subtracted.mp4"
call :process_video "SUBCAM_ALG_2020-02-02_12-00-40_background_subtracted.mp4"
call :process_video "SUBCAM_ALG_2020-02-03_09-00-41_background_subtracted.mp4"
call :process_video "SUBCAM_ALG_2020-02-08_09-00-41_background_subtracted.mp4"
call :process_video "algapelago_1_2025-06-20_14-00-48_background_subtracted.mp4"
call :process_video "algapelago_1_2025-06-21_10-00-48_background_subtracted.mp4"
call :process_video "algapelago_1_2025-06-21_12-00-48_background_subtracted.mp4"

cd ..\..

echo.
echo ==================================
echo Re-encoding Complete!
echo ==================================
echo.
echo Summary:
echo    Total videos: %total%
echo    Backups saved to: public\videos\backup\
echo.
echo Next Steps:
echo    1. Open dashboard: http://localhost:9002/motion-analysis
echo    2. Double-click any video to test
echo    3. Both videos should now play side-by-side
echo.
echo All done! Your videos should now work in the browser.
pause
exit /b 0

:process_video
set /a current+=1
set "video=%~1"

if not exist "%video%" (
    echo [%current%/%total%] Skipping %video% ^(file not found^)
    goto :eof
)

echo [%current%/%total%] Processing: %video%
echo    Backing up original...
copy "%video%" "backup\%video%" >nul

set "temp_file=%~n1_TEMP.mp4"

echo    Re-encoding with web-compatible codec...

REM Re-encode with web-compatible settings
ffmpeg -i "%video%" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -movflags +faststart -f lavfi -i "anullsrc=r=44100:cl=mono" -c:a aac -b:a 128k -shortest "%temp_file%" -y -loglevel error

if exist "%temp_file%" (
    move /y "%temp_file%" "%video%" >nul
    echo    Success!
) else (
    echo    Failed to re-encode %video%
    echo    Restored from backup
    copy "backup\%video%" "%video%" >nul
)

echo.
goto :eof
