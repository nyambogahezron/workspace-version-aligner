#!/usr/bin/env node

/**
 * Extension Verification Script
 * This script verifies the VS Code extension is properly built and configured
 */

const fs = require('fs');
const path = require('path');

function checkFile(filePath, description) {
	if (fs.existsSync(filePath)) {
		console.log(`✅ ${description} exists`);
		return true;
	} else {
		console.log(`❌ ${description} missing at: ${filePath}`);
		return false;
	}
}

function verifyExtension() {
	console.log('🚀 Verifying Workspace Version Aligner Extension...\n');

	let allChecks = true;
	const extensionRoot = __dirname;

	// Check essential files
	const essentialFiles = [
		['package.json', 'Extension manifest'],
		['out/extension.js', 'Compiled main extension file'],
		['out/core/WorkspaceScanner.js', 'Compiled WorkspaceScanner'],
		['out/core/PackageManager.js', 'Compiled PackageManager'],
		[
			'out/providers/WorkspaceTreeProvider.js',
			'Compiled WorkspaceTreeProvider',
		],
		['out/providers/PackageTreeProvider.js', 'Compiled PackageTreeProvider'],
		['out/webview/WorkspaceVersionAlignerPanel.js', 'Compiled WebView Panel'],
		['out/types/index.js', 'Compiled types'],
	];

	essentialFiles.forEach(([file, desc]) => {
		if (!checkFile(path.join(extensionRoot, file), desc)) {
			allChecks = false;
		}
	});

	// Verify package.json structure
	console.log('\n📦 Verifying package.json structure...');
	try {
		const packageJson = JSON.parse(
			fs.readFileSync(path.join(extensionRoot, 'package.json'), 'utf-8')
		);

		const requiredFields = [
			'name',
			'displayName',
			'description',
			'version',
			'engines',
			'main',
			'contributes',
		];
		requiredFields.forEach((field) => {
			if (packageJson[field]) {
				console.log(`✅ Field '${field}' is present`);
			} else {
				console.log(`❌ Field '${field}' is missing`);
				allChecks = false;
			}
		});

		// Check VS Code engine requirement
		if (packageJson.engines?.vscode) {
			console.log(
				`✅ VS Code engine requirement: ${packageJson.engines.vscode}`
			);
		} else {
			console.log(`❌ VS Code engine requirement missing`);
			allChecks = false;
		}

		// Check commands
		const commands = packageJson.contributes?.commands || [];
		const expectedCommands = [
			'workspaceVersionAligner.openPanel',
			'workspaceVersionAligner.scanWorkspaces',
			'workspaceVersionAligner.addPackage',
			'workspaceVersionAligner.removePackage',
			'workspaceVersionAligner.syncVersions',
			'workspaceVersionAligner.resolveConflicts',
		];

		console.log(
			`\n🎯 Verifying commands (${expectedCommands.length} expected)...`
		);
		expectedCommands.forEach((cmdId) => {
			const found = commands.find((cmd) => cmd.command === cmdId);
			if (found) {
				console.log(`✅ Command '${cmdId}' is defined`);
			} else {
				console.log(`❌ Command '${cmdId}' is missing`);
				allChecks = false;
			}
		});

		// Check activation events
		const activationEvents = packageJson.activationEvents || [];
		console.log(`\n⚡ Activation events (${activationEvents.length} found):`);
		activationEvents.forEach((event) => {
			console.log(`  - ${event}`);
		});

		// Check views and viewsContainers
		if (packageJson.contributes.viewsContainers?.activitybar) {
			console.log(`✅ Activity bar container is defined`);
		} else {
			console.log(`❌ Activity bar container is missing`);
			allChecks = false;
		}

		if (packageJson.contributes.views?.workspaceVersionAligner) {
			console.log(`✅ Tree views are defined`);
		} else {
			console.log(`❌ Tree views are missing`);
			allChecks = false;
		}
	} catch (error) {
		console.log(`❌ Error reading package.json: ${error.message}`);
		allChecks = false;
	}

	// Check test workspace
	console.log('\n🧪 Verifying test workspace...');
	const testWorkspace = path.join(extensionRoot, 'test-workspace');
	if (fs.existsSync(testWorkspace)) {
		console.log(`✅ Test workspace exists at: ${testWorkspace}`);

		// Check test workspace structure
		const testFiles = [
			'package.json',
			'apps/app1/package.json',
			'packages/package1/package.json',
		];

		testFiles.forEach((file) => {
			checkFile(path.join(testWorkspace, file), `Test file: ${file}`);
		});
	} else {
		console.log(`⚠️  Test workspace not found (optional)`);
	}

	// Summary
	console.log('\n' + '='.repeat(50));
	if (allChecks) {
		console.log(
			'🎉 Extension verification PASSED! The extension is ready for testing.'
		);
		console.log('\nNext steps:');
		console.log('1. Press F5 to launch Extension Development Host');
		console.log('2. Open a workspace with package.json files');
		console.log(
			'3. Use Ctrl+Shift+P and search for "Workspace Version Aligner"'
		);
		console.log('4. Test the extension commands and webview');
	} else {
		console.log(
			'❌ Extension verification FAILED! Please fix the issues above.'
		);
		process.exit(1);
	}
}

verifyExtension();
