@echo off
REM FSR Data Recorder Setup and Launch

echo Installing required packages...
pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo ERROR: Failed to install packages
    echo Make sure you have Python installed and pip is available
    pause
    exit /b 1
)

echo.
echo Starting FSR Data Recorder...
python fsr_recorder.py

if errorlevel 1 (
    echo.
    echo ERROR: Failed to start application
    pause
    exit /b 1
)
