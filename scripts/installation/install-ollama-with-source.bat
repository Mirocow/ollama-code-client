@echo off
REM Script to install Node.js 22 and Ollama Code with source information
REM This script handles the installation process and sets the installation source
REM
REM Repository: http://178.140.10.58:8082/ai/ollama-code.git
REM
REM Usage: install-ollama-with-source.bat --source [gitlab|npm|internal|local-build]
REM        install-ollama-with-source.bat -s [gitlab|npm|internal|local-build]

setlocal enabledelayedexpansion

set "SOURCE=unknown"
set "PACKAGE_NAME=@ollama-code/ollama-code"
set "CLI_COMMAND=ollama-code"
set "DATA_DIR_NAME=.ollama-code"
set "REQUIRED_NODE_VERSION=22"
set "GIT_REPOSITORY=http://178.140.10.58:8082/ai/ollama-code.git"

REM Parse command line arguments
:parse_args
if "%~1"=="" goto end_parse
if /i "%~1"=="--source" (
    set "SOURCE=%~2"
    shift
    shift
    goto parse_args
)
if /i "%~1"=="-s" (
    set "SOURCE=%~2"
    shift
    shift
    goto parse_args
)
if /i "%~1"=="--help" goto show_help
if /i "%~1"=="-h" goto show_help
if /i "%~1"=="gitlab" set "SOURCE=gitlab"
if /i "%~1"=="npm" set "SOURCE=npm"
if /i "%~1"=="internal" set "SOURCE=internal"
if /i "%~1"=="local-build" set "SOURCE=local-build"
shift
goto parse_args

:show_help
echo Usage: %~nx0 [OPTIONS]
echo.
echo Options:
echo   -s, --source SOURCE    Specify the installation source (e.g., gitlab, npm, internal)
echo   -h, --help             Show this help message
echo.
echo Supported Source Values:
echo   gitlab       - Clone from GitLab and build from source
echo   npm          - Install from npm registry
echo   internal     - Internal installation
echo   local-build  - Local build installation
echo.
echo Repository: %GIT_REPOSITORY%
echo.
echo Examples:
echo   %~nx0 --source gitlab
echo   %~nx0 -s npm
exit /b 0

:end_parse

echo.
echo ==========================================
echo    Ollama Code Installation Script
echo    Node.js %REQUIRED_NODE_VERSION% + pnpm
echo ==========================================
echo.
echo INFO: Installation source: %SOURCE%
echo INFO: Required Node.js: v%REQUIRED_NODE_VERSION%
echo INFO: Repository: %GIT_REPOSITORY%
echo.

REM Check if Node.js is already installed
call :CheckCommandExists node
if !ERRORLEVEL! EQU 0 (
    for /f "delims=" %%i in ('node --version') do set "NODE_VERSION=%%i"
    echo INFO: Node.js is already installed: !NODE_VERSION!

    REM Extract major version number
    set "MAJOR_VERSION=!NODE_VERSION:v=!"
    for /f "tokens=1 delims=." %%a in ("!MAJOR_VERSION!") do (
        set "MAJOR_VERSION=%%a"
    )

    if !MAJOR_VERSION! GEQ %REQUIRED_NODE_VERSION% (
        echo INFO: Node.js version !NODE_VERSION! is sufficient. Skipping Node.js installation.
        goto :InstallPnpm
    ) else (
        echo INFO: Node.js version !NODE_VERSION! is too low. Need version %REQUIRED_NODE_VERSION% or higher.
        echo INFO: Installing Node.js %REQUIRED_NODE_VERSION%+
        call :InstallNodeJSDirectly
        if !ERRORLEVEL! NEQ 0 (
            echo ERROR: Failed to install Node.js. Cannot continue with Ollama Code installation.
            exit /b 1
        )
    )
) else (
    echo INFO: Node.js not found. Installing Node.js %REQUIRED_NODE_VERSION%+
    call :InstallNodeJSDirectly
    if !ERRORLEVEL! NEQ 0 (
        echo ERROR: Failed to install Node.js. Cannot continue with Ollama Code installation.
        exit /b 1
    )
)

:InstallPnpm
REM Verify npm is available before installing pnpm
REM Always use full path to npm to avoid local node_modules conflicts
set "NODEJS_PATH=C:\Program Files\nodejs"
set "NODEJS_PATH_X86=C:\Program Files (x86)\nodejs"

if exist "!NODEJS_PATH!\npm.cmd" (
    echo INFO: Using npm from !NODEJS_PATH!
    set "NPM_CMD=!NODEJS_PATH!\npm.cmd"
) else if exist "!NODEJS_PATH_X86!\npm.cmd" (
    echo INFO: Using npm from !NODEJS_PATH_X86!
    set "NPM_CMD=!NODEJS_PATH_X86!\npm.cmd"
) else (
    call :CheckCommandExists npm
    if !ERRORLEVEL! NEQ 0 (
        echo ERROR: npm command not found. Node.js installation may have failed.
        echo INFO: Please restart your command prompt and try again.
        echo INFO: If the problem persists, manually install Node.js from: https://nodejs.org/
        exit /b 1
    )
    set "NPM_CMD=npm"
)

REM Check if pnpm is installed, install if not
call :CheckCommandExists pnpm
if !ERRORLEVEL! NEQ 0 (
    echo INFO: Installing pnpm...
    call "%NPM_CMD%" install -g pnpm
    if !ERRORLEVEL! NEQ 0 (
        echo WARNING: Failed to install pnpm. Continuing with npm.
    ) else (
        echo SUCCESS: pnpm installed successfully.
    )
) else (
    echo SUCCESS: pnpm is already installed
    for /f "delims=" %%i in ('pnpm --version') do echo INFO: pnpm version: %%i
)

REM Handle different installation sources
if /i "%SOURCE%"=="gitlab" goto :InstallFromGitLab
if /i "%SOURCE%"=="local-build" goto :LocalBuild
goto :InstallFromNpm

:InstallFromGitLab
echo.
echo INFO: Installing from GitLab repository...
echo INFO: Repository: %GIT_REPOSITORY%

REM Check if git is installed
call :CheckCommandExists git
if !ERRORLEVEL! NEQ 0 (
    echo ERROR: git is not installed. Please install git first.
    echo INFO: Download from: https://git-scm.com/download/win
    exit /b 1
)

REM Clone or update repository
set "TARGET_DIR=%USERPROFILE%\ollama-code"
if exist "%TARGET_DIR%" (
    echo INFO: Directory %TARGET_DIR% already exists. Updating...
    cd /d "%TARGET_DIR%"
    git pull
    if !ERRORLEVEL! NEQ 0 (
        echo WARNING: Failed to update repository. Will try to continue...
    )
) else (
    echo INFO: Cloning repository to %TARGET_DIR%...
    git clone %GIT_REPOSITORY% "%TARGET_DIR%"
    if !ERRORLEVEL! NEQ 0 (
        echo ERROR: Failed to clone repository.
        exit /b 1
    )
    cd /d "%TARGET_DIR%"
)

REM Install dependencies
echo INFO: Installing dependencies with pnpm...
call pnpm install --frozen-lockfile 2>nul || call pnpm install
if !ERRORLEVEL! NEQ 0 (
    echo ERROR: Failed to install dependencies.
    exit /b 1
)

REM Build project
echo INFO: Building project...
call pnpm run build
if !ERRORLEVEL! NEQ 0 (
    echo WARNING: Build failed. Trying to continue...
)

REM Bundle CLI
echo INFO: Bundling CLI...
call pnpm run bundle
if !ERRORLEVEL! NEQ 0 (
    echo WARNING: Bundle failed. Trying to continue...
)

REM Link globally
echo INFO: Linking globally...
call npm link
if !ERRORLEVEL! NEQ 0 (
    echo WARNING: Failed to link globally. The CLI may not be available.
)

goto :CreateSourceJson

:LocalBuild
echo.
echo INFO: Local build installation...
echo ERROR: --dir option is required for local-build. Please specify the source directory.
echo INFO: Example: %~nx0 --source local-build --dir C:\path\to\ollama-code
exit /b 1

:InstallFromNpm
echo.
echo INFO: Installing Ollama Code from npm...
echo INFO: Running: %NPM_CMD% install -g %PACKAGE_NAME%
call "%NPM_CMD%" install -g %PACKAGE_NAME%

if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: Ollama Code installed successfully!
) else (
    echo ERROR: Failed to install Ollama Code.
    exit /b 1
)

:CreateSourceJson
REM After installation, create source.json in the .ollama-code directory
echo.
echo INFO: Creating source.json in %USERPROFILE%\%DATA_DIR_NAME%...

set "DATA_DIR=%USERPROFILE%\%DATA_DIR_NAME%"
if not exist "%DATA_DIR%" (
    mkdir "%DATA_DIR%"
)

REM Get current timestamp in ISO format
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set "INSTALL_DATE=%%c-%%a-%%b"
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set "INSTALL_TIME=%%a:%%b:00"
set "INSTALL_TIMESTAMP=%INSTALL_DATE%T%INSTALL_TIME%"

REM Get platform info
set "PLATFORM=windows"
set "ARCH=%PROCESSOR_ARCHITECTURE%"
if "%ARCH%"=="AMD64" set "ARCH=x64"

REM Create the source.json file with the installation source
(
echo {
echo   "source": "%SOURCE%",
echo   "installed_at": "%INSTALL_TIMESTAMP%",
echo   "platform": "%PLATFORM%",
echo   "arch": "%ARCH%",
echo   "node_version": "%REQUIRED_NODE_VERSION%",
echo   "repository": "%GIT_REPOSITORY%"
echo }
) > "%DATA_DIR%\source.json"

echo SUCCESS: Installation source saved to %USERPROFILE%\%DATA_DIR_NAME%\source.json

REM Verify installation
call :CheckCommandExists %CLI_COMMAND%
if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: Ollama Code is available as '%CLI_COMMAND%' command.
    call %CLI_COMMAND% --version
) else (
    echo WARNING: Ollama Code may not be in PATH. Please check your npm global bin directory.
    echo INFO: You may need to restart your command prompt.
)

echo.
echo ==========================================
echo SUCCESS: Installation completed!
echo ==========================================
echo.
echo The source information is stored in %USERPROFILE%\%DATA_DIR_NAME%\source.json
echo.
echo Usage:
echo   %CLI_COMMAND%          - Start interactive session
echo   %CLI_COMMAND% --help   - Show help
echo.
echo Quick Start:
echo   1. Run: %CLI_COMMAND%
echo   2. Configure your Ollama server URL if needed
echo   3. Start chatting with your AI assistant!
echo.

endlocal
exit /b 0

REM ============================================================
REM Function: CheckCommandExists
REM Description: Check if a command exists in the system
REM ============================================================
:CheckCommandExists
where %~1 >nul 2>&1
exit /b %ERRORLEVEL%

REM ============================================================
REM Function: InstallNodeJSDirectly
REM Description: Download and install Node.js directly from official website
REM ============================================================
:InstallNodeJSDirectly
echo INFO: Downloading Node.js %REQUIRED_NODE_VERSION%.x LTS from official website

REM Create temp directory for download
set "TEMP_DIR=%TEMP%\ollama-code-nodejs-install"
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

REM Determine architecture
set "ARCH=x64"
if "%PROCESSOR_ARCHITECTURE%"=="x86" set "ARCH=x86"
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" set "ARCH=x64"
if defined PROCESSOR_ARCHITEW6432 set "ARCH=x64"

REM Set Node.js download URL (LTS version 22.x)
set "NODE_VERSION=22.12.0"
set "NODE_URL=https://nodejs.org/dist/v!NODE_VERSION!/node-v!NODE_VERSION!-!ARCH!.msi"
set "NODE_INSTALLER=%TEMP_DIR%\nodejs-installer.msi"

echo INFO: Downloading from: !NODE_URL!
echo INFO: Architecture: !ARCH!

REM Download Node.js installer using PowerShell
powershell -Command "try { Invoke-WebRequest -Uri '!NODE_URL!' -OutFile '!NODE_INSTALLER!' -UseBasicParsing; Write-Host 'Download completed successfully.' } catch { Write-Host 'Download failed:' $_.Exception.Message; exit 1 }"

if !ERRORLEVEL! NEQ 0 (
    echo ERROR: Failed to download Node.js installer from official source.
    echo INFO: Please manually download and install Node.js from: https://nodejs.org/
    echo INFO: After manual installation, restart your command prompt and run this script again.
    exit /b 1
)

if not exist "!NODE_INSTALLER!" (
    echo ERROR: Node.js installer not found after download.
    exit /b 1
)

echo INFO: Installing Node.js silently
REM Install Node.js silently
msiexec /i "!NODE_INSTALLER!" /quiet /norestart ADDLOCAL=ALL

if !ERRORLEVEL! NEQ 0 (
    echo ERROR: Failed to install Node.js.
    echo INFO: You may need to run this script as Administrator.
    echo INFO: Or manually install Node.js from: https://nodejs.org/
    exit /b 1
)

echo INFO: Node.js installation completed.

REM Clean up installer
del "!NODE_INSTALLER!" 2>nul
rmdir "!TEMP_DIR!" 2>nul

REM Refresh environment variables
echo INFO: Refreshing environment variables
call :RefreshEnvVars

REM Verify installation and return success
set "NODEJS_INSTALL_PATH=C:\Program Files\nodejs"
if exist "!NODEJS_INSTALL_PATH!\node.exe" (
    for /f "delims=" %%i in ('"!NODEJS_INSTALL_PATH!\node.exe" --version') do set "NODE_VERSION=%%i"
    echo SUCCESS: Node.js !NODE_VERSION! installed successfully!
    exit /b 0
)

set "NODEJS_INSTALL_PATH_X86=C:\Program Files (x86)\nodejs"
if exist "!NODEJS_INSTALL_PATH_X86!\node.exe" (
    for /f "delims=" %%i in ('"!NODEJS_INSTALL_PATH_X86!\node.exe" --version') do set "NODE_VERSION=%%i"
    echo SUCCESS: Node.js !NODE_VERSION! installed successfully!
    exit /b 0
)

call :CheckCommandExists node
if !ERRORLEVEL! EQU 0 (
    for /f "delims=" %%i in ('node --version') do set "NODE_VERSION=%%i"
    echo SUCCESS: Node.js !NODE_VERSION! installed successfully!
    exit /b 0
) else (
    echo WARNING: Node.js installed but not found in PATH.
    echo INFO: Trying to use Node.js from default installation path

    REM Try to use Node.js directly from installation path
    set "NODE_PATH=C:\Program Files\nodejs"
    if exist "%NODE_PATH%\node.exe" (
        echo INFO: Found Node.js at %NODE_PATH%
        REM Update PATH for current session
        set "PATH=%PATH%;%NODE_PATH%"

        REM Test if node works now
        "%NODE_PATH%\node.exe" --version >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            for /f "delims=" %%i in ('"%NODE_PATH%\node.exe" --version') do set "NODE_VERSION=%%i"
            echo SUCCESS: Node.js %NODE_VERSION% is working from %NODE_PATH%
            exit /b 0
        )
    )

    REM Try x86 path
    set "NODE_PATH_X86=C:\Program Files (x86)\nodejs"
    if exist "%NODE_PATH_X86%\node.exe" (
        echo INFO: Found Node.js at %NODE_PATH_X86%
        REM Update PATH for current session
        set "PATH=%PATH%;%NODE_PATH_X86%"

        REM Test if node works now
        "%NODE_PATH_X86%\node.exe" --version >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            for /f "delims=" %%i in ('"%NODE_PATH_X86%\node.exe" --version') do set "NODE_VERSION=%%i"
            echo SUCCESS: Node.js %NODE_VERSION% is working from %NODE_PATH_X86%
            exit /b 0
        )
    )

    echo ERROR: Node.js installation completed but cannot be executed
    exit /b 1
)

exit /b 0

REM ============================================================
REM Function: RefreshEnvVars
REM Description: Refresh environment variables without restarting
REM ============================================================
:RefreshEnvVars
REM Add Node.js to PATH if not already there
set "NODEJS_DIR=C:\Program Files\nodejs"
if exist "!NODEJS_DIR!\node.exe" (
    echo INFO: Found Node.js at !NODEJS_DIR!
    set "PATH=!PATH!;!NODEJS_DIR!"
)

REM Try alternative path for x86 systems
set "NODEJS_DIR_X86=C:\Program Files (x86)\nodejs"
if exist "!NODEJS_DIR_X86!\node.exe" (
    echo INFO: Found Node.js at !NODEJS_DIR_X86!
    set "PATH=!PATH!;!NODEJS_DIR_X86!"
)

exit /b 0
