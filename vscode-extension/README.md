# Workspace Version Aligner - VS Code Extension

A VS Code extension that provides a visual interface for managing package versions across monorepo workspaces. This extension is based on the CLI tool and offers the same functionality through an intuitive graphical interface.

## Features

- **Visual Workspace Management**: View all workspaces (root, apps, packages) in a tree view
- **Interactive Package Management**: Add, update, and remove packages across selected workspaces
- **Version Conflict Detection**: Automatically find packages with different versions across workspaces
- **Version Synchronization**: Sync package versions across all workspaces
- **Dry Run Mode**: Preview changes before applying them
- **Package Manager Support**: Works with npm, yarn, pnpm, and bun
- **Latest Version Fetching**: Automatically fetch latest versions from npm registry

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Workspace Version Aligner"
4. Click Install

## Usage

### Opening the Extension

- **Command Palette**: Press `Ctrl+Shift+P` and type "Open Version Aligner"
- **Context Menu**: Right-click on any `package.json` file and select "Open Version Aligner"
- **Activity Bar**: Click on the Version Aligner icon in the activity bar

### Main Features

#### 1. Workspace Overview

- View all detected workspaces organized by type (root, apps, packages)
- Click on any workspace to open its package.json file

#### 2. Add/Update Packages

- Enter package name and version
- Select dependency type (dependencies, devDependencies, peerDependencies)
- Choose target workspaces
- Preview changes with dry run mode

#### 3. Remove Packages

- Select package from dropdown (populated with existing packages)
- Choose workspaces to remove from
- Preview changes before applying

#### 4. Sync Package Versions

- Enter package name to check current versions
- Select target version from available options
- Sync across all workspaces using that package

#### 5. Version Conflict Resolution

- Automatically detect packages with multiple versions
- View detailed conflict information
- Resolve conflicts by selecting target versions

#### 6. Package Installation

- Install packages after making changes
- Automatic package manager detection
- Support for monorepo and individual workspace installation

### Tree Views

The extension provides two tree views in the activity bar:

- **Workspaces**: Shows all detected workspaces organized by type
- **Packages**: Shows all packages with conflict indicators

## Commands

- `workspaceVersionAligner.openPanel`: Open the main Version Aligner panel
- `workspaceVersionAligner.scanWorkspaces`: Scan for workspaces
- `workspaceVersionAligner.addPackage`: Add/update a package
- `workspaceVersionAligner.removePackage`: Remove a package
- `workspaceVersionAligner.syncVersions`: Sync package versions
- `workspaceVersionAligner.resolveConflicts`: Resolve version conflicts

## Requirements

- VS Code 1.74.0 or higher
- Node.js (for npm operations)
- A monorepo with `package.json` files in root, `apps/`, and/or `packages/` directories

## Supported Project Structures

```
your-monorepo/
├── package.json          # Root workspace
├── apps/
│   ├── app1/
│   │   └── package.json  # App workspace
│   └── app2/
│       └── package.json  # App workspace
└── packages/
    ├── pkg1/
    │   └── package.json  # Package workspace
    └── pkg2/
        └── package.json  # Package workspace
```

## Development

To contribute to this extension:

1. Clone the repository
2. Install dependencies: `npm install`
3. Open in VS Code
4. Press F5 to run the extension in a new Extension Development Host window

### Build Commands

- `npm run compile`: Compile TypeScript
- `npm run watch`: Watch for changes and compile
- `npm run vscode:prepublish`: Prepare for publishing

## License

MIT License - see LICENSE file for details

## Related

This extension is based on the [Workspace Version Aligner CLI tool](../README.md).
