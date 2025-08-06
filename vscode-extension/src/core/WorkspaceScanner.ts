import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceInfo, PackageJson } from '../types';

export class WorkspaceScanner {
	private workspaces: WorkspaceInfo[] = [];
	private _onWorkspacesChanged = new vscode.EventEmitter<WorkspaceInfo[]>();
	public readonly onWorkspacesChanged = this._onWorkspacesChanged.event;

	constructor(private rootPath?: string) {
		this.rootPath =
			rootPath ||
			vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
			process.cwd();
	}

	async scanWorkspaces(): Promise<WorkspaceInfo[]> {
		this.workspaces = [];

		try {
			// Add root workspace
			const rootPackageJsonPath = path.join(this.rootPath, 'package.json');
			if (fs.existsSync(rootPackageJsonPath)) {
				const rootPackageJson = JSON.parse(
					fs.readFileSync(rootPackageJsonPath, 'utf-8')
				) as PackageJson;
				this.workspaces.push({
					path: this.rootPath,
					name: rootPackageJson.name || 'root',
					type: 'root',
					packageJson: rootPackageJson,
					relativePath: '.',
				});
			}

			// Scan apps directory
			const appsPath = path.join(this.rootPath, 'apps');
			if (fs.existsSync(appsPath)) {
				const apps = fs.readdirSync(appsPath);
				for (const app of apps) {
					const appPath = path.join(appsPath, app);
					const packageJsonPath = path.join(appPath, 'package.json');

					if (
						fs.existsSync(packageJsonPath) &&
						fs.statSync(appPath).isDirectory()
					) {
						const packageJson = JSON.parse(
							fs.readFileSync(packageJsonPath, 'utf-8')
						) as PackageJson;
						this.workspaces.push({
							path: appPath,
							name: packageJson.name || app,
							type: 'app',
							packageJson,
							relativePath: `apps/${app}`,
						});
					}
				}
			}

			// Scan packages directory
			const packagesPath = path.join(this.rootPath, 'packages');
			if (fs.existsSync(packagesPath)) {
				const packages = fs.readdirSync(packagesPath);
				for (const pkg of packages) {
					const pkgPath = path.join(packagesPath, pkg);
					const packageJsonPath = path.join(pkgPath, 'package.json');

					if (
						fs.existsSync(packageJsonPath) &&
						fs.statSync(pkgPath).isDirectory()
					) {
						const packageJson = JSON.parse(
							fs.readFileSync(packageJsonPath, 'utf-8')
						) as PackageJson;
						this.workspaces.push({
							path: pkgPath,
							name: packageJson.name || pkg,
							type: 'package',
							packageJson,
							relativePath: `packages/${pkg}`,
						});
					}
				}
			}

			this._onWorkspacesChanged.fire(this.workspaces);
			return this.workspaces;
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to scan workspaces: ${error}`);
			throw error;
		}
	}

	getWorkspaces(): WorkspaceInfo[] {
		return this.workspaces;
	}

	getWorkspacesByType(type: 'app' | 'package' | 'root'): WorkspaceInfo[] {
		return this.workspaces.filter((w) => w.type === type);
	}

	getWorkspaceByPath(path: string): WorkspaceInfo | undefined {
		return this.workspaces.find((w) => w.path === path);
	}

	hasPackage(workspace: WorkspaceInfo, packageName: string): boolean {
		const allDeps = {
			...workspace.packageJson.dependencies,
			...workspace.packageJson.devDependencies,
			...workspace.packageJson.peerDependencies,
		};
		return packageName in allDeps;
	}

	getPackageVersion(
		workspace: WorkspaceInfo,
		packageName: string
	): string | undefined {
		const allDeps = {
			...workspace.packageJson.dependencies,
			...workspace.packageJson.devDependencies,
			...workspace.packageJson.peerDependencies,
		};
		return allDeps[packageName];
	}

	getAllPackagesInWorkspace(workspace: WorkspaceInfo): Record<string, string> {
		return {
			...workspace.packageJson.dependencies,
			...workspace.packageJson.devDependencies,
			...workspace.packageJson.peerDependencies,
		};
	}

	refresh(): void {
		this.scanWorkspaces().catch(console.error);
	}
}
