# Installation Guide for Ollama Code with Source Tracking

This guide describes how to install Node.js and Ollama Code with source information tracking.

## Overview

The installation scripts automate the process of installing Node.js (if not present or below version 20), pnpm, and Ollama Code, while capturing and storing the installation source information for analytics and tracking purposes.

## Installation Scripts

We provide platform-specific installation scripts:

- **Linux/macOS**: `install-ollama-with-source.sh`
- **Windows**: `install-ollama-with-source.bat`

## Linux/macOS Installation

### Script: install-ollama-with-source.sh

#### Features:

- Checks for existing Node.js installation and version
- Installs Node.js 20+ if needed using NVM
- Installs pnpm package manager
- Installs system dependencies (build tools, git, etc.)
- Installs Ollama Code globally with source information
- Stores the source information in `~/.ollama-code/source.json`
- Supports building from source code

#### Usage:

```bash
# Install with a specific source
./install-ollama-with-source.sh --source github

# Install with internal source
./install-ollama-with-source.sh -s internal

# Build from local source
./install-ollama-with-source.sh --source local-build --build-from-source --dir /path/to/ollama-code

# Show help
./install-ollama-with-source.sh --help
```

#### Supported Source Values:

- `github` - Installed from GitHub repository
- `npm` - Installed from npm registry
- `internal` - Internal installation
- `local-build` - Local build installation

#### How it Works:

1. The script accepts a `--source` parameter to specify where Ollama Code is being installed from
2. It installs system dependencies if needed (git, build tools, etc.)
3. It installs Node.js if needed
4. It installs pnpm package manager
5. It installs Ollama Code globally (or builds from source)
6. It creates `~/.ollama-code/source.json` with the specified source information

#### Platform-Specific Notes:

**macOS:**
- Requires Xcode Command Line Tools (will prompt to install if missing)
- Homebrew is recommended for installing dependencies

**Linux:**
- Supports apt, yum, dnf, and pacman package managers
- Build tools (gcc, make) are required for native modules

#### Important Notes:

⚠️ **After installation, you need to restart your terminal or run:**

```bash
source ~/.bashrc  # For bash users
# or
source ~/.zshrc   # For zsh users
```

This is required to load the newly installed Node.js and Ollama Code into your PATH.

#### Prerequisites:

- curl or wget (for NVM installation and script download)
- bash-compatible shell
- (Optional) Homebrew on macOS

## Windows Installation

### Script: install-ollama-with-source.bat

#### Features:

- Checks for existing Node.js installation and version (requires version 20+)
- Automatically downloads and installs Node.js 20 LTS if not present or version is too low
- Installs pnpm package manager
- Installs Ollama Code globally with source information
- Stores the source information in `%USERPROFILE%\.ollama-code\source.json`

#### Prerequisites:

- **PowerShell (Administrator)**: The script must be run in PowerShell with Administrator privileges
- Internet connection for downloading Node.js and Ollama Code

#### Usage:

> ⚠️ **Important**: You must run PowerShell as Administrator to install Node.js and global npm packages.

**Step 1**: Open PowerShell as Administrator

- Right-click on PowerShell and select "Run as Administrator"
- Or press `Win + X` and select "Windows PowerShell (Admin)"

**Step 2**: Navigate to the script directory and run:

```powershell
# Install with a specific source using --source parameter
./install-ollama-with-source.bat --source github

# Install with short parameter
./install-ollama-with-source.bat -s internal

# Use default source (unknown)
./install-ollama-with-source.bat
```

#### Supported Source Values:

- `github` - Installed from GitHub repository
- `npm` - Installed from npm registry
- `internal` - Internal installation
- `local-build` - Local build installation

#### How it Works:

1. The script accepts a `--source` or `-s` parameter to specify where Ollama Code is being installed from
2. It checks if Node.js is already installed and if the version is 20 or higher
3. If Node.js is not installed or version is too low, it automatically downloads and installs Node.js 20 LTS
4. It installs pnpm if not available
5. It installs Ollama Code globally using npm
6. It creates `%USERPROFILE%\.ollama-code\source.json` with the specified source information

#### Why Administrator Privileges are Required:

- Installing Node.js requires writing to `C:\Program Files\nodejs`
- Installing global npm packages requires elevated permissions
- Modifying system PATH environment variables requires Administrator access

## Installation Source Feature

### Overview

This feature implements the ability to capture and store the installation source of the Ollama Code package. The source information is used for analytics and tracking purposes.

### Storage Location

The installation source is stored in a separate file at:

- **Unix/Linux/macOS**: `~/.ollama-code/source.json`
- **Windows**: `%USERPROFILE%\.ollama-code\source.json` (equivalent to `C:\Users\{username}\.ollama-code\source.json`)

### File Format

The `source.json` file contains:

```json
{
  "source": "github",
  "installed_at": "2024-01-15T10:30:00",
  "platform": "macos",
  "arch": "arm64"
}
```

### How the Source Information is Used

1. **Telemetry Tracking**: The source information is included in telemetry logs
2. **Analytics**: Helps understand how users are discovering and installing Ollama Code
3. **Distribution Analysis**: Tracks which distribution channels are most popular

### Verification

After installation and restarting your terminal (or sourcing your shell configuration), you can verify the source information:

**Linux/macOS:**

```bash
cat ~/.ollama-code/source.json
```

**Windows:**

```cmd
type %USERPROFILE%\.ollama-code\source.json
```

## Manual Installation (Without Source Tracking)

If you prefer not to use the installation scripts or don't want source tracking:

### Prerequisites

- Node.js 20+ (https://nodejs.org/)
- pnpm (recommended) or npm

### NPM Installation

```bash
# Using npm
npm install -g @ollama-code/ollama-code@latest

# Using pnpm
pnpm add -g @ollama-code/ollama-code@latest
```

### Build from Source

```bash
# Clone the repository
git clone http://178.140.10.58:8082/ai/ollama-code.git
cd ollama-code

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Bundle CLI
pnpm run bundle

# Link globally
npm link
```

## Troubleshooting

### Script Execution Issues

**Linux/macOS:**

```bash
# Make sure script is executable
chmod +x install-ollama-with-source.sh

# Run the script
./install-ollama-with-source.sh --source github
```

**Windows (PowerShell as Administrator):**

```powershell
# Run the script with --source parameter
./install-ollama-with-source.bat --source github

# Or with short parameter
./install-ollama-with-source.bat -s github
```

### Node.js Installation Issues

**Linux/macOS:**

- Ensure NVM is installed: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash`
- Restart your terminal or run: `source ~/.bashrc`

**Windows:**

- Install Node.js from: https://nodejs.org/
- After installation, run the script again

### Permission Issues

You may need administrative privileges for global npm installation:

- **Linux/macOS**: Use `sudo` with npm or use user-level prefix (script handles this automatically)
- **Windows**: Run PowerShell as Administrator

### Native Module Issues

If you encounter errors with native modules (like `node-pty`):

**macOS:**
```bash
xcode-select --install
```

**Ubuntu/Debian:**
```bash
sudo apt-get install build-essential python3
```

**CentOS/RHEL:**
```bash
sudo yum groupinstall "Development Tools"
sudo yum install python3
```

## Notes

- The scripts require internet access to download Node.js and Ollama Code
- Administrative privileges may be required for global npm installation
- The installation source is stored locally and used for tracking purposes only
- If the source file is missing or invalid, the application continues to work normally
