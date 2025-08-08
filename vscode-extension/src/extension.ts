import * as vscode from 'vscode';
import { WorkspaceVersionAlignerPanel } from './webview/WorkspaceVersionAlignerPanel';
import { WorkspaceScanner } from './core/WorkspaceScanner';
import { PackageManager } from './core/PackageManager';
import { WorkspaceTreeProvider } from './providers/WorkspaceTreeProvider';
import { PackageTreeProvider } from './providers/PackageTreeProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Workspace Version Aligner extension is now active!');

	const workspaceScanner = new WorkspaceScanner();
	const packageManager = new PackageManager(workspaceScanner);

	// Initialize tree providers
	const workspaceTreeProvider = new WorkspaceTreeProvider(workspaceScanner);
	const packageTreeProvider = new PackageTreeProvider(workspaceScanner);

	// Register tree views
	vscode.window.createTreeView('workspaceVersionAligner.workspaceTree', {
		treeDataProvider: workspaceTreeProvider,
		showCollapseAll: true,
	});

	vscode.window.createTreeView('workspaceVersionAligner.packageTree', {
		treeDataProvider: packageTreeProvider,
		showCollapseAll: true,
	});

	// Set context for when workspaces are available
	workspaceScanner.onWorkspacesChanged(() => {
		const hasWorkspaces = workspaceScanner.getWorkspaces().length > 0;
		vscode.commands.executeCommand(
			'setContext',
			'workspaceVersionAligner.hasWorkspaces',
			hasWorkspaces
		);
		vscode.commands.executeCommand(
			'setContext',
			'workspaceVersionAligner.hasPackages',
			hasWorkspaces
		);

		// Refresh tree providers
		workspaceTreeProvider.refresh();
		packageTreeProvider.refresh();
	});

	// Register commands
	const openPanelCommand = vscode.commands.registerCommand(
		'workspaceVersionAligner.openPanel',
		() => {
			WorkspaceVersionAlignerPanel.render(
				context.extensionUri,
				workspaceScanner,
				packageManager
			);
		}
	);

	const scanWorkspacesCommand = vscode.commands.registerCommand(
		'workspaceVersionAligner.scanWorkspaces',
		async () => {
			try {
				await workspaceScanner.scanWorkspaces();
				vscode.window.showInformationMessage(
					`Found ${workspaceScanner.getWorkspaces().length} workspaces`
				);
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to scan workspaces: ${error}`);
			}
		}
	);

	const addPackageCommand = vscode.commands.registerCommand(
		'workspaceVersionAligner.addPackage',
		async () => {
			try {
				const packageName = await vscode.window.showInputBox({
					prompt: 'Enter package name',
					placeHolder: 'e.g., typescript, react, lodash',
				});

				if (!packageName) return;

				const version = await vscode.window.showInputBox({
					prompt: 'Enter package version',
					placeHolder: 'e.g., ^5.6.0, latest, ~4.0.0',
					value: 'latest',
				});

				if (!version) return;

				const dependencyType = await vscode.window.showQuickPick(
					[
						{ label: 'devDependencies', value: 'devDependencies' },
						{ label: 'dependencies', value: 'dependencies' },
						{ label: 'peerDependencies', value: 'peerDependencies' },
					],
					{
						placeHolder: 'Select dependency type',
					}
				);

				if (!dependencyType) return;

				// Open the main panel to handle workspace selection and execution
				WorkspaceVersionAlignerPanel.render(
					context.extensionUri,
					workspaceScanner,
					packageManager
				);

				// Send the add package command to the webview
				setTimeout(() => {
					WorkspaceVersionAlignerPanel.currentPanel?.postMessage({
						command: 'addPackage',
						data: {
							packageName,
							version,
							dependencyType: dependencyType.value,
						},
					});
				}, 500);
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to add package: ${error}`);
			}
		}
	);

	const removePackageCommand = vscode.commands.registerCommand(
		'workspaceVersionAligner.removePackage',
		async () => {
			// Get all packages across workspaces
			const allPackages = packageManager.getAllPackages();

			if (allPackages.length === 0) {
				vscode.window.showWarningMessage('No packages found in workspaces');
				return;
			}

			const packageToRemove = await vscode.window.showQuickPick(
				allPackages.map((pkg) => ({ label: pkg, value: pkg })),
				{ placeHolder: 'Select package to remove' }
			);

			if (!packageToRemove) return;

			// Open the main panel to handle workspace selection and execution
			WorkspaceVersionAlignerPanel.render(
				context.extensionUri,
				workspaceScanner,
				packageManager
			);

			setTimeout(() => {
				WorkspaceVersionAlignerPanel.currentPanel?.postMessage({
					command: 'removePackage',
					data: { packageName: packageToRemove.value },
				});
			}, 500);
		}
	);

	const syncVersionsCommand = vscode.commands.registerCommand(
		'workspaceVersionAligner.syncVersions',
		async () => {
			const packageName = await vscode.window.showInputBox({
				prompt: 'Enter package name to sync',
				placeHolder: 'e.g., typescript, react',
			});

			if (!packageName) return;

			// Open the main panel
			WorkspaceVersionAlignerPanel.render(
				context.extensionUri,
				workspaceScanner,
				packageManager
			);

			setTimeout(() => {
				WorkspaceVersionAlignerPanel.currentPanel?.postMessage({
					command: 'syncVersions',
					data: { packageName },
				});
			}, 500);
		}
	);

	const resolveConflictsCommand = vscode.commands.registerCommand(
		'workspaceVersionAligner.resolveConflicts',
		() => {
			WorkspaceVersionAlignerPanel.render(
				context.extensionUri,
				workspaceScanner,
				packageManager
			);

			setTimeout(() => {
				WorkspaceVersionAlignerPanel.currentPanel?.postMessage({
					command: 'resolveConflicts',
				});
			}, 500);
		}
	);

	// Initial scan
	workspaceScanner.scanWorkspaces().catch(console.error);

	context.subscriptions.push(
		openPanelCommand,
		scanWorkspacesCommand,
		addPackageCommand,
		removePackageCommand,
		syncVersionsCommand,
		resolveConflictsCommand
	);
}

export function deactivate() {
	// Clean up resources
}
