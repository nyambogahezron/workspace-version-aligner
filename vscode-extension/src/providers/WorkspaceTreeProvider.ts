import * as vscode from 'vscode';
import { WorkspaceScanner } from '../core/WorkspaceScanner';
import { WorkspaceInfo } from '../types';

export class WorkspaceTreeProvider
	implements vscode.TreeDataProvider<WorkspaceTreeItem>
{
	private _onDidChangeTreeData: vscode.EventEmitter<
		WorkspaceTreeItem | undefined | null | void
	> = new vscode.EventEmitter<WorkspaceTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<
		WorkspaceTreeItem | undefined | null | void
	> = this._onDidChangeTreeData.event;

	constructor(private workspaceScanner: WorkspaceScanner) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: WorkspaceTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: WorkspaceTreeItem): Thenable<WorkspaceTreeItem[]> {
		if (!element) {
			// Root level - show workspace types
			const workspaces = this.workspaceScanner.getWorkspaces();
			const types = new Set(workspaces.map((w) => w.type));

			return Promise.resolve(
				Array.from(types).map((type) => {
					const icon = this.getTypeIcon(type);
					const count = workspaces.filter((w) => w.type === type).length;
					return new WorkspaceTreeItem(
						`${icon} ${type.toUpperCase()}S (${count})`,
						type,
						vscode.TreeItemCollapsibleState.Expanded
					);
				})
			);
		} else {
			// Show workspaces of this type
			const workspaces = this.workspaceScanner.getWorkspacesByType(
				element.workspaceType as any
			);
			return Promise.resolve(
				workspaces.map((workspace) => {
					const icon = this.getTypeIcon(workspace.type);
					return new WorkspaceTreeItem(
						`${icon} ${workspace.name}`,
						workspace.type,
						vscode.TreeItemCollapsibleState.None,
						workspace
					);
				})
			);
		}
	}

	private getTypeIcon(type: string): string {
		switch (type) {
			case 'app':
				return '📱';
			case 'package':
				return '📦';
			case 'root':
				return '🏠';
			default:
				return '📄';
		}
	}
}

export class WorkspaceTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly workspaceType: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly workspace?: WorkspaceInfo
	) {
		super(label, collapsibleState);

		if (workspace) {
			this.tooltip = `${workspace.name} (${workspace.relativePath})`;
			this.description = workspace.relativePath;
			this.contextValue = 'workspace';
			this.command = {
				command: 'vscode.open',
				title: 'Open package.json',
				arguments: [vscode.Uri.file(workspace.path + '/package.json')],
			};
		} else {
			this.contextValue = 'workspaceType';
		}
	}
}
