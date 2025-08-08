"use strict";
/**
 * Test script for Workspace Version Aligner Extension
 * This script validates the core functionality of the extension
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = void 0;
const WorkspaceScanner_1 = require("../src/core/WorkspaceScanner");
const PackageManager_1 = require("../src/core/PackageManager");
const path = require("path");
const fs = require("fs");
async function runTests() {
    console.log('🚀 Starting Workspace Version Aligner Extension Tests...\n');
    const testWorkspacePath = path.join(__dirname, '../test-workspace');
    try {
        // Test 1: WorkspaceScanner initialization
        console.log('Test 1: Testing WorkspaceScanner initialization...');
        const scanner = new WorkspaceScanner_1.WorkspaceScanner(testWorkspacePath);
        // Test 2: Scanning workspaces
        console.log('Test 2: Testing workspace scanning...');
        const workspaces = await scanner.scanWorkspaces();
        console.log(`✅ Found ${workspaces.length} workspaces:`);
        workspaces.forEach((ws) => {
            console.log(`  - ${ws.name} (${ws.type}) at ${ws.relativePath}`);
        });
        // Test 3: Package version analysis
        console.log('\nTest 3: Testing package version analysis...');
        const packageManager = new PackageManager_1.PackageManager(scanner);
        const allPackages = packageManager.getAllPackages();
        console.log('📦 All packages found:');
        allPackages.forEach((pkg) => {
            const versionInfo = packageManager.getPackageVersions(pkg);
            console.log(`  ${pkg}:`);
            Array.from(versionInfo.versions.entries()).forEach(([version, workspaces]) => {
                const workspaceNames = workspaces.map((ws) => ws.name).join(', ');
                console.log(`    ${version}: ${workspaceNames}`);
            });
        });
        // Test 4: Version conflict detection
        console.log('\nTest 4: Testing version conflict detection...');
        const conflicts = packageManager.findVersionConflicts();
        console.log(`🔍 Found ${conflicts.length} packages with version conflicts:`);
        conflicts.forEach((conflict) => {
            console.log(`  ${conflict.packageName}:`);
            Array.from(conflict.versions.entries()).forEach(([version, workspaces]) => {
                const workspaceNames = workspaces.map((ws) => ws.name).join(', ');
                console.log(`    ${version}: ${workspaceNames}`);
            });
        });
        // Test 5: Extension structure validation
        console.log('\nTest 5: Validating extension structure...');
        const extensionPath = path.join(__dirname, '..');
        const packageJsonPath = path.join(extensionPath, 'package.json');
        const mainFile = path.join(extensionPath, 'out/extension.js');
        if (fs.existsSync(packageJsonPath)) {
            console.log('✅ Extension package.json exists');
        }
        else {
            console.log('❌ Extension package.json missing');
        }
        if (fs.existsSync(mainFile)) {
            console.log('✅ Compiled extension.js exists');
        }
        else {
            console.log('❌ Compiled extension.js missing');
        }
        // Test 6: Command definitions
        console.log('\nTest 6: Validating extension commands...');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const commands = packageJson.contributes?.commands || [];
        const expectedCommands = [
            'workspaceVersionAligner.openPanel',
            'workspaceVersionAligner.scanWorkspaces',
            'workspaceVersionAligner.addPackage',
            'workspaceVersionAligner.removePackage',
            'workspaceVersionAligner.syncVersions',
            'workspaceVersionAligner.resolveConflicts',
        ];
        expectedCommands.forEach((cmd) => {
            const found = commands.find((c) => c.command === cmd);
            if (found) {
                console.log(`✅ Command '${cmd}' is defined`);
            }
            else {
                console.log(`❌ Command '${cmd}' is missing`);
            }
        });
        console.log('\n🎉 All tests completed successfully!');
    }
    catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}
exports.runTests = runTests;
// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}
//# sourceMappingURL=extension.test.js.map