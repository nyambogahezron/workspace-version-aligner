import * as vscode from 'vscode';
import { WorkspaceScanner } from '../core/WorkspaceScanner';

export class PackageTreeProvider
	implements vscode.TreeDataProvider<PackageTreeItem>
{
	private _onDidChangeTreeData: vscode.EventEmitter<
		PackageTreeItem | undefined | null | void
	> = new vscode.EventEmitter<PackageTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<
		PackageTreeItem | undefined | null | void
	> = this._onDidChangeTreeData.event;

	constructor(private workspaceScanner: WorkspaceScanner) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: PackageTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: PackageTreeItem): Thenable<PackageTreeItem[]> {
		if (!element) {
			// Root level - show all packages
			const packageMap = new Map<string, Map<string, string[]>>();

			this.workspaceScanner.getWorkspaces().forEach((workspace) => {
				const allDeps = {
					...workspace.packageJson.dependencies,
					...workspace.packageJson.devDependencies,
					...workspace.packageJson.peerDependencies,
				};

				Object.entries(allDeps).forEach(([name, version]) => {
					if (!packageMap.has(name)) {
						packageMap.set(name, new Map());
					}
					const versionMap = packageMap.get(name)!;
					if (!versionMap.has(version)) {
						versionMap.set(version, []);
					}
					versionMap.get(version)!.push(workspace.name);
				});
			});

			return Promise.resolve(
				Array.from(packageMap.entries())
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([packageName, versionMap]) => {
						const hasConflict = versionMap.size > 1;
						const icon = hasConflict ? '⚠️' : '📦';
						const suffix = hasConflict ? ` (${versionMap.size} versions)` : '';

						return new PackageTreeItem(
							`${icon} ${packageName}${suffix}`,
							packageName,
							vscode.TreeItemCollapsibleState.Collapsed,
							hasConflict
						);
					})
			);
		} else {
			// Show versions of this package
			const packageVersions = this.getPackageVersions(element.packageName);

			return Promise.resolve(
				Array.from(packageVersions.entries()).map(([version, workspaces]) => {
					return new PackageTreeItem(
						`${version} (${workspaces.length} workspace${
							workspaces.length > 1 ? 's' : ''
						})`,
						element.packageName,
						vscode.TreeItemCollapsibleState.Collapsed,
						false,
						version,
						workspaces
					);
				})
			);
		}
	}

	private getPackageVersions(packageName: string): Map<string, string[]> {
		const versionMap = new Map<string, string[]>();

		this.workspaceScanner.getWorkspaces().forEach((workspace) => {
			const allDeps = {
				...workspace.packageJson.dependencies,
				...workspace.packageJson.devDependencies,
				...workspace.packageJson.peerDependencies,
			};

			if (allDeps[packageName]) {
				const version = allDeps[packageName];
				if (!versionMap.has(version)) {
					versionMap.set(version, []);
				}
				versionMap.get(version)!.push(workspace.name);
			}
		});

		return versionMap;
	}
}

export class PackageTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly packageName: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly hasConflict: boolean,
		public readonly version?: string,
		public readonly workspaces?: string[]
	) {
		super(label, collapsibleState);

		if (version && workspaces) {
			this.tooltip = `${packageName}@${version}\nUsed in: ${workspaces.join(
				', '
			)}`;
			this.contextValue = 'packageVersion';
		} else {
			this.tooltip = `${packageName}`;
			this.contextValue = hasConflict ? 'packageWithConflict' : 'package';
		}

		if (hasConflict) {
			this.iconPath = new vscode.ThemeIcon(
				'warning',
				new vscode.ThemeColor('problemsWarningIcon.foreground')
			);
		}
	}
}
