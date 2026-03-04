# Installation Guide for Ollama Code with Source Tracking

This guide describes how to install Node.js 22 and Ollama Code with source information tracking.

## Overview

The installation scripts automate the process of installing Node.js 22 (if not present or below version 22), pnpm, and Ollama Code, while capturing and storing the installation source information for analytics and tracking purposes.

**Repository:** http://178.140.10.58:8082/ai/ollama-code.git

## Requirements

- **Node.js:** v22.x (required)
- **pnpm:** v10.x or higher (recommended)
- **OS:** Linux, macOS, Windows

## Installation Scripts

We provide platform-specific installation scripts:

- **Linux/macOS**: `install-ollama-with-source.sh`
- **Windows**: `install-ollama-with-source.bat`

## Linux/macOS Installation

### Script: install-ollama-with-source.sh

#### Features:

- Checks for existing Node.js installation and version
- Installs Node.js 22 if needed using NVM
- Installs pnpm package manager
- Installs system dependencies (build tools, git, etc.)
- Installs Ollama Code from npm or builds from GitLab source
- Stores the source information in `~/.ollama-code/source.json`

#### Usage:

```bash
# Install from npm (default)
./install-ollama-with-source.sh --source npm

# Install from GitLab (clone and build)
./install-ollama-with-source.sh --source gitlab

# Build from local source
./install-ollama-with-source.sh --source local-build --dir /path/to/ollama-code

# Show help
./install-ollama-with-source.sh --help
```

#### Supported Source Values:

- `gitlab` - Clone from GitLab and build from source
- `npm` - Install from npm registry
- `internal` - Internal installation (npm)
- `local-build` - Local build installation

#### How it Works:

1. The script accepts a `--source` parameter to specify where Ollama Code is being installed from
2. It installs system dependencies if needed (git, build tools, etc.)
3. It installs Node.js 22 via NVM if needed
4. It installs pnpm package manager
5. It installs Ollama Code (from npm or builds from source)
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

- Checks for existing Node.js installation and version (requires version 22+)
- Automatically downloads and installs Node.js 22 LTS if not present or version is too low
- Installs pnpm package manager
- Installs Ollama Code from npm or GitLab source
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
# Install from npm
./install-ollama-with-source.bat --source npm

# Install from GitLab (clone and build)
./install-ollama-with-source.bat --source gitlab

# Use default source (npm)
./install-ollama-with-source.bat
```

#### Supported Source Values:

- `gitlab` - Clone from GitLab and build from source
- `npm` - Install from npm registry
- `internal` - Internal installation (npm)
- `local-build` - Local build installation

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
  "source": "gitlab",
  "installed_at": "2024-01-15T10:30:00",
  "platform": "macos",
  "arch": "arm64",
  "node_version": "22",
  "repository": "http://178.140.10.58:8082/ai/ollama-code.git"
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

- Node.js 22+ (https://nodejs.org/)
- pnpm v10+ (recommended) or npm

### NPM Installation

```bash
# Using npm
npm install -g @ollama-code/ollama-code@latest

# Using pnpm
pnpm add -g @ollama-code/ollama-code@latest
```

### Build from Source (GitLab)

```bash
# Clone the repository
git clone http://178.140.10.58:8082/ai/ollama-code.git
cd ollama-code

# Load nvm and use Node.js 22
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22

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
./install-ollama-with-source.sh --source gitlab
```

**Windows (PowerShell as Administrator):**

```powershell
# Run the script with --source parameter
./install-ollama-with-source.bat --source gitlab

# Or with short parameter
./install-ollama-with-source.bat -s npm
```

### Node.js Installation Issues

**Linux/macOS:**

- Ensure NVM is installed: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash`
- Restart your terminal or run: `source ~/.bashrc`
- Install Node.js 22: `nvm install 22 && nvm use 22`

**Windows:**

- Install Node.js 22 from: https://nodejs.org/
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

### Git Clone Issues (GitLab)

If you have trouble cloning from GitLab:

```bash
# Check if you have access to the repository
curl -I http://178.140.10.58:8082/ai/ollama-code.git

# If authentication is required, configure git credentials
git config --global credential.helper store

# Then try cloning again
git clone http://178.140.10.58:8082/ai/ollama-code.git
```

## Notes

- The scripts require internet access to download Node.js and Ollama Code
- Administrative privileges may be required for global npm installation
- The installation source is stored locally and used for tracking purposes only
- If the source file is missing or invalid, the application continues to work normally
- Node.js 22 is the required version for this project
- pnpm is the recommended package manager (faster and more efficient than npm)
