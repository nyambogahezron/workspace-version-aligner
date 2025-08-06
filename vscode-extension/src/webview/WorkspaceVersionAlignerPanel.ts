import * as vscode from 'vscode';
import { WorkspaceScanner } from '../core/WorkspaceScanner';
import { PackageManager } from '../core/PackageManager';
import { getWebviewContent } from './webviewContent';

export class WorkspaceVersionAlignerPanel {
	public static currentPanel: WorkspaceVersionAlignerPanel | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private _disposables: vscode.Disposable[] = [];

	public static render(
		extensionUri: vscode.Uri,
		workspaceScanner: WorkspaceScanner,
		packageManager: PackageManager
	) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (WorkspaceVersionAlignerPanel.currentPanel) {
			WorkspaceVersionAlignerPanel.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'workspaceVersionAligner',
			'Workspace Version Aligner',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.joinPath(extensionUri, 'out'),
					vscode.Uri.joinPath(extensionUri, 'webview-ui', 'build'),
				],
			}
		);

		WorkspaceVersionAlignerPanel.currentPanel =
			new WorkspaceVersionAlignerPanel(
				panel,
				extensionUri,
				workspaceScanner,
				packageManager
			);
	}

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		private workspaceScanner: WorkspaceScanner,
		private packageManager: PackageManager
	) {
		this._panel = panel;

		this._panel.onDidDispose(this.dispose, null, this._disposables);
		this._panel.webview.html = getWebviewContent(
			this._panel.webview,
			extensionUri
		);
		this._setWebviewMessageListener(this._panel.webview);

		// Send initial data
		this.sendInitialData();
	}

	private async sendInitialData() {
		const workspaces = this.workspaceScanner.getWorkspaces();
		const conflicts = this.packageManager.findVersionConflicts();
		const packageManager = await this.packageManager.detectPackageManager();

		this._panel.webview.postMessage({
			command: 'initialData',
			data: {
				workspaces,
				conflicts,
				packageManager,
			},
		});
	}

	public postMessage(message: any) {
		this._panel.webview.postMessage(message);
	}

	private _setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(
			async (message: any) => {
				const { command, data } = message;

				switch (command) {
					case 'scanWorkspaces':
						await this.handleScanWorkspaces();
						break;

					case 'addPackage':
						await this.handleAddPackage(data);
						break;

					case 'removePackage':
						await this.handleRemovePackage(data);
						break;

					case 'syncVersions':
						await this.handleSyncVersions(data);
						break;

					case 'resolveConflicts':
						await this.handleResolveConflicts(data);
						break;

					case 'installPackages':
						await this.handleInstallPackages(data);
						break;

					case 'fetchLatestVersion':
						await this.handleFetchLatestVersion(data);
						break;

					case 'getPackageVersions':
						await this.handleGetPackageVersions(data);
						break;
				}
			},
			null,
			this._disposables
		);
	}

	private async handleScanWorkspaces() {
		try {
			await this.workspaceScanner.scanWorkspaces();
			const workspaces = this.workspaceScanner.getWorkspaces();

			this._panel.webview.postMessage({
				command: 'workspacesScanned',
				data: { workspaces },
			});

			vscode.window.showInformationMessage(
				`Found ${workspaces.length} workspaces`
			);
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'error',
				data: { message: `Failed to scan workspaces: ${error}` },
			});
		}
	}

	private async handleAddPackage(data: any) {
		try {
			const changes = await this.packageManager.addOrUpdatePackage(data.config);

			this._panel.webview.postMessage({
				command: 'packageAdded',
				data: { changes, dryRun: data.config.dryRun },
			});

			if (!data.config.dryRun) {
				await this.sendUpdatedData();
				vscode.window.showInformationMessage(
					`Package ${data.config.packageName} updated successfully`
				);
			}
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'error',
				data: { message: `Failed to add package: ${error}` },
			});
		}
	}

	private async handleRemovePackage(data: any) {
		try {
			const changes = await this.packageManager.removePackage(
				data.packageName,
				data.targetWorkspaces,
				data.dryRun
			);

			this._panel.webview.postMessage({
				command: 'packageRemoved',
				data: { changes, dryRun: data.dryRun },
			});

			if (!data.dryRun) {
				await this.sendUpdatedData();
				vscode.window.showInformationMessage(
					`Package ${data.packageName} removed successfully`
				);
			}
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'error',
				data: { message: `Failed to remove package: ${error}` },
			});
		}
	}

	private async handleSyncVersions(data: any) {
		try {
			const result = await this.packageManager.syncPackageVersions(
				data.packageName,
				data.targetVersion,
				data.dryRun
			);

			this._panel.webview.postMessage({
				command: 'versionsSynced',
				data: { result, dryRun: data.dryRun },
			});

			if (!data.dryRun) {
				await this.sendUpdatedData();
				vscode.window.showInformationMessage(
					`Package ${data.packageName} versions synced successfully`
				);
			}
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'error',
				data: { message: `Failed to sync versions: ${error}` },
			});
		}
	}

	private async handleResolveConflicts(data: any) {
		try {
			const conflicts = this.packageManager.findVersionConflicts();

			this._panel.webview.postMessage({
				command: 'conflictsFound',
				data: { conflicts },
			});
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'error',
				data: { message: `Failed to resolve conflicts: ${error}` },
			});
		}
	}

	private async handleInstallPackages(data: any) {
		try {
			this._panel.webview.postMessage({
				command: 'installationStarted',
			});

			const result = await this.packageManager.installPackages(
				data.targetWorkspaces
			);

			this._panel.webview.postMessage({
				command: 'installationCompleted',
				data: { result },
			});

			if (result.success) {
				vscode.window.showInformationMessage('Packages installed successfully');
			} else {
				vscode.window.showErrorMessage(`Installation failed: ${result.error}`);
			}
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'error',
				data: { message: `Installation failed: ${error}` },
			});
		}
	}

	private async handleFetchLatestVersion(data: any) {
		try {
			const latestVersion = await this.packageManager.fetchLatestVersion(
				data.packageName
			);

			this._panel.webview.postMessage({
				command: 'latestVersionFetched',
				data: { packageName: data.packageName, latestVersion },
			});
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'latestVersionFetched',
				data: { packageName: data.packageName, latestVersion: null },
			});
		}
	}

	private async handleGetPackageVersions(data: any) {
		try {
			const versionInfo = this.packageManager.getPackageVersions(
				data.packageName
			);

			this._panel.webview.postMessage({
				command: 'packageVersionsRetrieved',
				data: { versionInfo },
			});
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'error',
				data: { message: `Failed to get package versions: ${error}` },
			});
		}
	}

	private async sendUpdatedData() {
		const workspaces = this.workspaceScanner.getWorkspaces();
		const conflicts = this.packageManager.findVersionConflicts();

		this._panel.webview.postMessage({
			command: 'dataUpdated',
			data: { workspaces, conflicts },
		});
	}

	public dispose() {
		WorkspaceVersionAlignerPanel.currentPanel = undefined;
		this._panel.dispose();

		while (this._disposables.length) {
			const disposable = this._disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}
	}
}
