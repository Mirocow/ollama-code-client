#!/bin/bash

# Ollama Code Installation Script
# This script installs Node.js 22 (via NVM), pnpm, and Ollama Code CLI
# Supports Linux and macOS
#
# Repository: http://178.140.10.58:8082/ai/ollama-code.git
#
# Usage: install-ollama-with-source.sh --source [gitlab|npm|internal|local-build]
#        install-ollama-with-source.sh -s [gitlab|npm|internal|local-build]

# Re-execute with bash if running with sh or other shells
# This block must use POSIX-compliant syntax ([ not [[) since it runs before we know bash is available
if [ -z "${BASH_VERSION}" ] && [ -z "${__OLLAMA_INSTALL_REEXEC:-}" ]; then
    # Check if we're in a git hook environment
    case "${0}" in
        *.git/hooks/*) export __OLLAMA_IN_GIT_HOOK=1 ;;
    esac
    if [ -n "${GIT_DIR:-}" ]; then
        export __OLLAMA_IN_GIT_HOOK=1
    fi

    # Try to find bash
    if command -v bash >/dev/null 2>&1; then
        export __OLLAMA_INSTALL_REEXEC=1
        # Re-exec with bash, preserving all arguments
        exec bash -- "${0}" "$@"
    else
        echo "Error: This script requires bash. Please install bash first."
        exit 1
    fi
fi

# Enable strict mode (bash-specific options)
# pipefail requires bash 3+; check before setting
if [ -n "${BASH_VERSION:-}" ]; then
    # shellcheck disable=SC3040
    set -eo pipefail
else
    set -e
fi

# ============================================
# Configuration
# ============================================
OLLAMA_CODE_DIR="${OLLAMA_CODE_DIR:-}"
PACKAGE_NAME="@ollama-code/ollama-code"
CLI_COMMAND="ollama-code"
DATA_DIR_NAME=".ollama-code"
REQUIRED_NODE_VERSION="22"
GIT_REPOSITORY="http://178.140.10.58:8082/ai/ollama-code.git"

# ============================================
# Color definitions
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================
# Log functions
# ============================================
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${CYAN}▶ $1${NC}"
}

# ============================================
# Utility functions
# ============================================
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

get_shell_profile() {
    local current_shell
    current_shell=$(basename "${SHELL}")
    case "${current_shell}" in
        bash)
            echo "${HOME}/.bashrc"
            ;;
        zsh)
            echo "${HOME}/.zshrc"
            ;;
        fish)
            echo "${HOME}/.config/fish/config.fish"
            ;;
        *)
            echo "${HOME}/.profile"
            ;;
    esac
}

get_platform_info() {
    local os_type
    os_type=$(uname -s)
    local arch_type
    arch_type=$(uname -m)

    case "${os_type}" in
        Darwin)
            PLATFORM="macos"
            PACKAGE_MANAGER="${PACKAGE_MANAGER:-$(command -v brew >/dev/null 2>&1 && echo 'brew' || echo 'none')}"
            ;;
        Linux)
            PLATFORM="linux"
            if command -v apt-get >/dev/null 2>&1; then
                PACKAGE_MANAGER="apt"
            elif command -v yum >/dev/null 2>&1; then
                PACKAGE_MANAGER="yum"
            elif command -v dnf >/dev/null 2>&1; then
                PACKAGE_MANAGER="dnf"
            elif command -v pacman >/dev/null 2>&1; then
                PACKAGE_MANAGER="pacman"
            else
                PACKAGE_MANAGER="none"
            fi
            ;;
        *)
            PLATFORM="unknown"
            PACKAGE_MANAGER="none"
            ;;
    esac

    ARCH="${arch_type}"
}

# ============================================
# Parse command line arguments
# ============================================
SOURCE="unknown"
BUILD_FROM_SOURCE="false"
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--source)
            if [[ -z "$2" ]] || [[ "$2" == -* ]]; then
                log_error "--source requires a value"
                exit 1
            fi
            SOURCE="$2"
            shift 2
            ;;
        --build-from-source)
            BUILD_FROM_SOURCE="true"
            shift
            ;;
        --dir)
            if [[ -z "$2" ]] || [[ "$2" == -* ]]; then
                log_error "--dir requires a value"
                exit 1
            fi
            OLLAMA_CODE_DIR="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -s, --source SOURCE       Specify the installation source (e.g., gitlab, npm, internal, local-build)"
            echo "  --build-from-source       Build from source code instead of npm"
            echo "  --dir DIR                 Path to source directory (for local-build)"
            echo "  -h, --help                Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --source gitlab                 # Install from GitLab"
            echo "  $0 --source npm                    # Install from npm"
            echo "  $0 --source local-build --dir /path/to/ollama-code  # Build from local source"
            echo ""
            echo "Repository: ${GIT_REPOSITORY}"
            echo ""
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ============================================
# Print header
# ============================================
print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}       ${GREEN}Ollama Code Installation Script${NC}                       ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}       ${YELLOW}Node.js ${REQUIRED_NODE_VERSION} + pnpm${NC}                              ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    get_platform_info
    log_info "Platform: ${PLATFORM} (${ARCH})"
    log_info "Shell: $(basename "${SHELL}")"
    log_info "Package Manager: ${PACKAGE_MANAGER}"
    log_info "Installation Source: ${SOURCE}"
    log_info "Required Node.js: v${REQUIRED_NODE_VERSION}"
    if [[ "${BUILD_FROM_SOURCE}" == "true" ]]; then
        log_info "Build Mode: From Source"
    fi
    echo ""
}

# ============================================
# Ensure download tool is available
# ============================================
ensure_download_tool() {
    if command_exists curl; then
        DOWNLOAD_CMD="curl"
        DOWNLOAD_ARGS="-fsSL"
        return 0
    fi

    if command_exists wget; then
        DOWNLOAD_CMD="wget"
        DOWNLOAD_ARGS="-qO -"
        return 0
    fi

    log_error "Neither curl nor wget found"
    log_info "Please install curl or wget manually:"
    echo "  - macOS: brew install curl"
    echo "  - Ubuntu/Debian: sudo apt-get install curl"
    echo "  - CentOS/RHEL: sudo yum install curl"
    echo "  - Arch Linux: sudo pacman -S curl"
    exit 1
}

# ============================================
# Install system dependencies
# ============================================
install_system_dependencies() {
    log_step "Checking system dependencies..."

    local missing_deps=()

    # Check for git
    if ! command_exists git; then
        missing_deps+=("git")
    fi

    # Check for curl or wget
    if ! command_exists curl && ! command_exists wget; then
        missing_deps+=("curl")
    fi

    # Check for build tools (needed for node-pty)
    case "${PLATFORM}" in
        macos)
            if ! command_exists xcode-select || ! xcode-select -p >/dev/null 2>&1; then
                log_warning "Xcode Command Line Tools not found. Installing..."
                xcode-select --install 2>/dev/null || true
            fi
            ;;
        linux)
            if ! command_exists make || ! command_exists gcc; then
                case "${PACKAGE_MANAGER}" in
                    apt)
                        missing_deps+=("build-essential" "python3")
                        ;;
                    yum|dnf)
                        missing_deps+=("gcc-c++" "make" "python3")
                        ;;
                    pacman)
                        missing_deps+=("base-devel" "python")
                        ;;
                esac
            fi
            ;;
    esac

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_warning "Missing dependencies: ${missing_deps[*]}"
        log_info "Installing missing dependencies..."

        case "${PACKAGE_MANAGER}" in
            brew)
                brew install "${missing_deps[@]}" || {
                    log_error "Failed to install dependencies with Homebrew"
                    exit 1
                }
                ;;
            apt)
                sudo apt-get update -qq
                sudo apt-get install -y "${missing_deps[@]}" || {
                    log_error "Failed to install dependencies with apt"
                    exit 1
                }
                ;;
            yum)
                sudo yum install -y "${missing_deps[@]}" || {
                    log_error "Failed to install dependencies with yum"
                    exit 1
                }
                ;;
            dnf)
                sudo dnf install -y "${missing_deps[@]}" || {
                    log_error "Failed to install dependencies with dnf"
                    exit 1
                }
                ;;
            pacman)
                sudo pacman -S --noconfirm "${missing_deps[@]}" || {
                    log_error "Failed to install dependencies with pacman"
                    exit 1
                }
                ;;
            none)
                log_error "No package manager found. Please install: ${missing_deps[*]}"
                exit 1
                ;;
        esac

        log_success "Dependencies installed"
    else
        log_success "All system dependencies are installed"
    fi
}

# ============================================
# Clean npm configuration conflicts
# ============================================
clean_npmrc_conflict() {
    local npmrc="${HOME}/.npmrc"
    if [[ -f "${npmrc}" ]]; then
        log_info "Cleaning npmrc conflicts..."
        grep -Ev '^(prefix|globalconfig) *= *' "${npmrc}" > "${npmrc}.tmp" || true
        mv -f "${npmrc}.tmp" "${npmrc}" || true
    fi
}

# ============================================
# Install NVM
# ============================================
install_nvm() {
    local NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
    local NVM_VERSION="${NVM_VERSION:-v0.40.3}"

    if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
        log_info "NVM is already installed at ${NVM_DIR}"
        return 0
    fi

    log_step "Installing NVM ${NVM_VERSION}..."

    # Download and install NVM
    local NVM_INSTALL_TEMP
    NVM_INSTALL_TEMP=$(mktemp)

    # Try official NVM source first
    if "${DOWNLOAD_CMD}" "${DOWNLOAD_ARGS}" "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" > "${NVM_INSTALL_TEMP}" 2>/dev/null; then
        # Run the script in current shell environment
        # shellcheck source=/dev/null
        . "${NVM_INSTALL_TEMP}"
        rm -f "${NVM_INSTALL_TEMP}"
        log_success "NVM installed successfully"
    else
        rm -f "${NVM_INSTALL_TEMP}"
        log_error "Failed to install NVM"
        log_info "Please install NVM manually: https://github.com/nvm-sh/nvm#install--update-script"
        exit 1
    fi

    # Configure shell profile
    local PROFILE_FILE
    PROFILE_FILE=$(get_shell_profile)

    # Check if profile file is writable
    if [[ -f "${PROFILE_FILE}" ]] && [[ ! -w "${PROFILE_FILE}" ]]; then
        log_warning "Cannot write to ${PROFILE_FILE} (permission denied)"
        log_info "Skipping shell profile configuration"
        log_info "You may need to manually add NVM configuration to your shell profile"
    elif ! grep -q 'NVM_DIR' "${PROFILE_FILE}" 2>/dev/null; then
        # shellcheck disable=SC2016
        {
            echo ""
            echo "# NVM configuration (added by Ollama Code installer)"
            echo "export NVM_DIR=\"\$HOME/.nvm\""
            echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
            echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"'
        } >> "${PROFILE_FILE}" 2>/dev/null || {
            log_warning "Failed to write to ${PROFILE_FILE}"
            log_info "Skipping shell profile configuration"
            return 0
        }
        log_info "Added NVM config to ${PROFILE_FILE}"
    fi

    # Load NVM for current session
    export NVM_DIR="${NVM_DIR}"
    # shellcheck source=/dev/null
    [[ -s "${NVM_DIR}/nvm.sh" ]] && \. "${NVM_DIR}/nvm.sh"

    log_success "NVM configured successfully"
    return 0
}

# ============================================
# Install Node.js via NVM
# ============================================
install_nodejs_with_nvm() {
    local NODE_VERSION="${NODE_VERSION:-${REQUIRED_NODE_VERSION}}"
    local NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"

    # Ensure NVM is loaded
    export NVM_DIR="${NVM_DIR}"
    # shellcheck source=/dev/null
    [[ -s "${NVM_DIR}/nvm.sh" ]] && \. "${NVM_DIR}/nvm.sh"

    if ! command_exists nvm; then
        log_error "NVM not loaded properly"
        return 1
    fi

    # Install Node.js
    log_step "Installing Node.js v${NODE_VERSION}..."
    if nvm install "${NODE_VERSION}"; then
        nvm alias default "${NODE_VERSION}" || true
        nvm use default || true
        log_success "Node.js v${NODE_VERSION} installed successfully"

        # Verify installation
        log_info "Node.js version: $(node -v)" || true
        log_info "npm version: $(npm -v)" || true

        return 0
    else
        log_error "Failed to install Node.js"
        return 1
    fi
}

# ============================================
# Check Node.js version
# ============================================
check_node_version() {
    if ! command_exists node; then
        return 1
    fi

    local current_version
    current_version=$(node -v | sed 's/v//')
    local major_version
    major_version=$(echo "${current_version}" | cut -d. -f1)

    if [[ "${major_version}" -ge "${REQUIRED_NODE_VERSION}" ]]; then
        log_success "Node.js v${current_version} is already installed (>= ${REQUIRED_NODE_VERSION})"
        return 0
    else
        log_warning "Node.js v${current_version} is installed but version < ${REQUIRED_NODE_VERSION}"
        return 1
    fi
}

# ============================================
# Install Node.js
# ============================================
install_nodejs() {
    local platform
    platform=$(uname -s)

    case "${platform}" in
        Linux|Darwin)
            log_step "Installing Node.js ${REQUIRED_NODE_VERSION} on ${platform}..."

            # Install NVM
            if ! install_nvm; then
                log_error "Failed to install NVM"
                return 1
            fi

            # Load NVM
            export NVM_DIR="${HOME}/.nvm"
            # shellcheck source=/dev/null
            [[ -s "${NVM_DIR}/nvm.sh" ]] && \. "${NVM_DIR}/nvm.sh"

            # Install Node.js
            if ! install_nodejs_with_nvm; then
                log_error "Failed to install Node.js"
                return 1
            fi
            ;;
        MINGW*|CYGWIN*|MSYS*)
            log_error "Windows platform detected. Please use Windows installer or WSL."
            log_info "Visit: https://nodejs.org/en/download/"
            exit 1
            ;;
        *)
            log_error "Unsupported platform: ${platform}"
            exit 1
            ;;
    esac
}

# ============================================
# Check and install Node.js
# ============================================
check_and_install_nodejs() {
    if check_node_version; then
        log_info "Using existing Node.js installation"
        clean_npmrc_conflict
    else
        log_warning "Installing or upgrading Node.js to v${REQUIRED_NODE_VERSION}..."
        install_nodejs
    fi
}

# ============================================
# Install pnpm
# ============================================
install_pnpm() {
    log_step "Installing pnpm..."

    if command_exists pnpm; then
        local pnpm_version
        pnpm_version=$(pnpm --version)
        log_success "pnpm ${pnpm_version} is already installed"
        return 0
    fi

    # Install pnpm via npm corepack or npm
    if command_exists corepack; then
        corepack enable 2>/dev/null || true
        corepack prepare pnpm@latest --activate 2>/dev/null || {
            log_warning "Failed to install pnpm via corepack, using npm..."
            npm install -g pnpm
        }
    else
        npm install -g pnpm
    fi

    if command_exists pnpm; then
        log_success "pnpm $(pnpm --version) installed successfully"
        return 0
    else
        log_error "Failed to install pnpm"
        return 1
    fi
}

# ============================================
# Fix npm permissions (without using sudo)
# ============================================
fix_npm_permissions() {
    log_info "Checking npm permissions..."

    local NPM_GLOBAL_DIR
    NPM_GLOBAL_DIR=$(npm config get prefix 2>/dev/null) || true
    if [[ -z "${NPM_GLOBAL_DIR}" ]] || [[ "${NPM_GLOBAL_DIR}" == *"error"* ]]; then
        NPM_GLOBAL_DIR="${HOME}/.npm-global"
        npm config set prefix "${NPM_GLOBAL_DIR}"
        log_info "Set npm prefix to user directory: ${NPM_GLOBAL_DIR}"
        return 0
    fi

    # SAFETY CHECK: Never modify system directories
    case "${NPM_GLOBAL_DIR}" in
        /|/usr|/usr/local|/bin|/sbin|/lib|/lib64|/opt|/snap|/var|/etc)
            log_warning "npm prefix is a system directory (${NPM_GLOBAL_DIR})."
            log_info "Using user directory instead to avoid breaking system binaries."
            NPM_GLOBAL_DIR="${HOME}/.npm-global"
            npm config set prefix "${NPM_GLOBAL_DIR}"
            log_success "npm prefix set to: ${NPM_GLOBAL_DIR}"
            return 0
            ;;
        *)
            # Safe to proceed with non-system directory
            ;;
    esac

    # Check if npm global directory is writable
    if [[ -w "${NPM_GLOBAL_DIR}" ]]; then
        log_info "npm global directory is writable"
        return 0
    fi

    # If not writable, use user directory
    log_warning "npm global directory is not writable: ${NPM_GLOBAL_DIR}"
    log_info "Setting npm prefix to user directory..."

    NPM_GLOBAL_DIR="${HOME}/.npm-global"
    mkdir -p "${NPM_GLOBAL_DIR}"
    npm config set prefix "${NPM_GLOBAL_DIR}"

    log_success "npm prefix set to: ${NPM_GLOBAL_DIR}"

    # Add to PATH in shell profile
    local PROFILE_FILE
    PROFILE_FILE=$(get_shell_profile)
    if ! grep -q '.npm-global/bin' "${PROFILE_FILE}" 2>/dev/null; then
        {
            echo ""
            echo "# NPM global bin (added by Ollama Code installer)"
            echo "export PATH=\"\$HOME/.npm-global/bin:\$PATH\""
        } >> "${PROFILE_FILE}"
        log_info "Added npm global bin to PATH in ${PROFILE_FILE}"
    fi

    return 0
}

# ============================================
# Clone repository from GitLab
# ============================================
clone_from_gitlab() {
    local target_dir="${OLLAMA_CODE_DIR:-${HOME}/ollama-code}"

    log_step "Cloning Ollama Code from GitLab..."
    log_info "Repository: ${GIT_REPOSITORY}"
    log_info "Target directory: ${target_dir}"

    if [[ -d "${target_dir}" ]]; then
        log_warning "Directory ${target_dir} already exists"
        log_info "Updating existing repository..."
        cd "${target_dir}"
        git pull || {
            log_error "Failed to update repository"
            exit 1
        }
    else
        git clone "${GIT_REPOSITORY}" "${target_dir}" || {
            log_error "Failed to clone repository"
            exit 1
        }
        cd "${target_dir}"
    fi

    OLLAMA_CODE_DIR="${target_dir}"
    log_success "Repository cloned to ${target_dir}"
}

# ============================================
# Build from source
# ============================================
build_from_source() {
    local source_dir="${OLLAMA_CODE_DIR:-$(pwd)}"

    if [[ ! -d "${source_dir}" ]]; then
        log_error "Source directory not found: ${source_dir}"
        exit 1
    fi

    if [[ ! -f "${source_dir}/package.json" ]]; then
        log_error "package.json not found in ${source_dir}"
        exit 1
    fi

    log_step "Building Ollama Code from source..."
    log_info "Source directory: ${source_dir}"

    cd "${source_dir}"

    # Install dependencies
    log_info "Installing dependencies with pnpm..."
    pnpm install --frozen-lockfile || pnpm install

    # Build the project
    log_info "Building project..."
    pnpm run build || {
        log_error "Build failed"
        exit 1
    }

    # Bundle the CLI
    log_info "Bundling CLI..."
    pnpm run bundle || {
        log_error "Bundle failed"
        exit 1
    }

    # Link globally
    log_info "Linking globally..."
    npm link || {
        log_error "Failed to link globally"
        exit 1
    }

    log_success "Ollama Code built and linked from source"
}

# ============================================
# Install Ollama Code from npm
# ============================================
install_ollama_code_npm() {
    # Ensure NVM node is in PATH
    export NVM_DIR="${HOME}/.nvm"
    # shellcheck source=/dev/null
    [[ -s "${NVM_DIR}/nvm.sh" ]] && \. "${NVM_DIR}/nvm.sh" 2>/dev/null || true

    # Add npm global bin to PATH
    local NPM_GLOBAL_BIN
    NPM_GLOBAL_BIN=$(npm bin -g 2>/dev/null) || true
    if [[ -n "${NPM_GLOBAL_BIN}" ]]; then
        export PATH="${NPM_GLOBAL_BIN}:${PATH}"
    fi

    if command_exists "${CLI_COMMAND}"; then
        local CURRENT_VERSION
        CURRENT_VERSION=$("${CLI_COMMAND}" --version 2>/dev/null) || echo "unknown"
        log_success "Ollama Code is already installed: ${CURRENT_VERSION}"
        log_info "Upgrading to the latest version..."
    fi

    # Clean npmrc conflicts
    clean_npmrc_conflict

    # Fix npm permissions if needed
    fix_npm_permissions

    # Install Ollama Code
    log_step "Installing Ollama Code..."
    if npm install -g "${PACKAGE_NAME}@latest"; then
        log_success "Ollama Code installed successfully!"

        # Verify installation
        if command_exists "${CLI_COMMAND}"; then
            local installed_version
            installed_version=$("${CLI_COMMAND}" --version 2>/dev/null) || installed_version="unknown"
            log_info "Ollama Code version: ${installed_version}"
        fi
    else
        log_error "Failed to install Ollama Code!"
        log_info "Please check your internet connection and try again"
        exit 1
    fi
}

# ============================================
# Install from GitLab (clone + build)
# ============================================
install_from_gitlab() {
    clone_from_gitlab
    build_from_source
}

# ============================================
# Create source.json
# ============================================
create_source_json() {
    local DATA_DIR="${HOME}/${DATA_DIR_NAME}"

    mkdir -p "${DATA_DIR}"

    # Escape special characters in SOURCE for JSON
    local ESCAPED_SOURCE
    ESCAPED_SOURCE=$(printf '%s' "${SOURCE}" | sed 's/\\/\\\\/g; s/"/\\"/g')

    cat > "${DATA_DIR}/source.json" <<EOF
{
  "source": "${ESCAPED_SOURCE}",
  "installed_at": "$(date -Iseconds 2>/dev/null || date +%Y-%m-%dT%H:%M:%S)",
  "platform": "${PLATFORM}",
  "arch": "${ARCH}",
  "node_version": "${REQUIRED_NODE_VERSION}",
  "repository": "${GIT_REPOSITORY}"
}
EOF

    log_success "Installation source saved to ~/${DATA_DIR_NAME}/source.json"
}

# ============================================
# Main function
# ============================================
main() {
    # Validate HOME variable
    if [[ -z "${HOME}" ]]; then
        log_warning "HOME environment variable is not set"
        local MAIN_UID
        MAIN_UID=$(id -u) || true
        if [[ "${MAIN_UID}" -eq 0 ]]; then
            export HOME="/root"
        else
            local CURRENT_USER
            CURRENT_USER=$(whoami) || true
            local user_home
            user_home=$(eval echo "~${CURRENT_USER}") || true
            export HOME="${user_home}"
        fi
        log_info "Using HOME=${HOME}"
    fi

    # Print header
    print_header

    # Ensure download tool is available
    ensure_download_tool

    # Install system dependencies
    install_system_dependencies
    echo ""

    # Check and install Node.js
    check_and_install_nodejs
    echo ""

    # Install pnpm
    install_pnpm
    echo ""

    # Build from source, install from GitLab, or install from npm
    case "${SOURCE}" in
        gitlab)
            install_from_gitlab
            ;;
        local-build)
            if [[ -z "${OLLAMA_CODE_DIR}" ]]; then
                log_error "--dir is required for local-build source"
                exit 1
            fi
            build_from_source
            ;;
        npm)
            install_ollama_code_npm
            ;;
        internal)
            install_ollama_code_npm
            ;;
        *)
            # Default: install from npm
            install_ollama_code_npm
            ;;
    esac
    echo ""

    # Create source.json if source parameter was provided
    if [[ "${SOURCE}" != "unknown" ]]; then
        create_source_json
    fi

    # ============================================
    # Final instructions
    # ============================================
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}              ${CYAN}Installation completed!${NC}                        ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Ensure NVM and npm global bin are in PATH
    export NVM_DIR="${HOME}/.nvm"
    # shellcheck source=/dev/null
    [[ -s "${NVM_DIR}/nvm.sh" ]] && \. "${NVM_DIR}/nvm.sh" 2>/dev/null || true
    local NPM_GLOBAL_BIN
    NPM_GLOBAL_BIN=$(npm bin -g 2>/dev/null) || true
    if [[ -n "${NPM_GLOBAL_BIN}" ]]; then
        export PATH="${NPM_GLOBAL_BIN}:${PATH}"
    fi

    # Check if CLI is immediately available
    if command_exists "${CLI_COMMAND}"; then
        log_success "Ollama Code is ready to use!"
        echo ""
        echo -e "${CYAN}Usage:${NC}"
        echo "  ${CLI_COMMAND}          # Start interactive session"
        echo "  ${CLI_COMMAND} --help   # Show help"
        echo ""

        # Show quick start info
        echo -e "${CYAN}Quick Start:${NC}"
        echo "  1. Run: ${CLI_COMMAND}"
        echo "  2. Configure your Ollama server URL if needed"
        echo "  3. Start chatting with your AI assistant!"
    else
        log_warning "To start using Ollama Code, please run:"
        echo ""
        local PROFILE_FILE
        PROFILE_FILE=$(get_shell_profile)
        echo "  source ${PROFILE_FILE}"
        echo ""
        echo "Or simply restart your terminal, then run: ${CLI_COMMAND}"
    fi
}

# Run main function
main "$@"
