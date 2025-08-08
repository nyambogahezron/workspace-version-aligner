#!/bin/bash

# Workspace Version Aligner Extension - Installation & Test Script

echo "🚀 Workspace Version Aligner Extension - Installation & Test Script"
echo "=================================================================="

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo "❌ VS Code CLI not found. Please install VS Code or ensure 'code' command is available."
    exit 1
fi

echo "✅ VS Code CLI found"

# Check if extension package exists
EXTENSION_FILE="workspace-version-aligner-extension-1.0.0.vsix"
if [ ! -f "$EXTENSION_FILE" ]; then
    echo "❌ Extension package '$EXTENSION_FILE' not found."
    echo "Please run 'npm run package' first to create the extension package."
    exit 1
fi

echo "✅ Extension package found: $EXTENSION_FILE"

# Install the extension
echo "📦 Installing extension..."
code --install-extension "$EXTENSION_FILE" --force

if [ $? -eq 0 ]; then
    echo "✅ Extension installed successfully!"
else
    echo "❌ Failed to install extension"
    exit 1
fi

# Open test workspace
if [ -d "test-workspace" ]; then
    echo "🧪 Opening test workspace..."
    code test-workspace
    echo "✅ Test workspace opened"
else
    echo "⚠️  Test workspace not found. Creating a simple test workspace..."
    mkdir -p test-workspace
    cat > test-workspace/package.json << 'EOF'
{
  "name": "test-workspace",
  "private": true,
  "dependencies": {
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "typescript": "^4.9.4"
  }
}
EOF
    echo "✅ Simple test workspace created and opened"
    code test-workspace
fi

echo ""
echo "🎉 Installation complete! Next steps:"
echo "1. VS Code should now be open with the test workspace"
echo "2. Look for the 'Version Aligner' icon in the Activity Bar (left sidebar)"
echo "3. Press Ctrl+Shift+P and search for 'Workspace Version Aligner' commands"
echo "4. Try the 'Open Version Aligner' command to test the main panel"
echo ""
echo "📋 For detailed testing instructions, see TEST_PLAN.md"
echo "🔧 To uninstall: code --uninstall-extension nyambogahezron.workspace-version-aligner-extension"
