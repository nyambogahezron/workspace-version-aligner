import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { WorkspaceScanner } from './WorkspaceScanner';
import {
	UpdateConfig,
	WorkspaceInfo,
	PackageVersionInfo,
	ConflictResolution,
	PackageManagerType,
	InstallationResult,
	PackageJson,
} from '../types';

export class PackageManager {
	constructor(private workspaceScanner: WorkspaceScanner) {}

	async addOrUpdatePackage(config: UpdateConfig): Promise<
		Array<{
			workspace: string;
			action: string;
			before?: string;
			after: string;
		}>
	> {
		const changes: Array<{
			workspace: string;
			action: string;
			before?: string;
			after: string;
		}> = [];

		for (const workspacePath of config.targetWorkspaces) {
			const workspace = this.workspaceScanner.getWorkspaceByPath(workspacePath);
			if (!workspace) continue;

			const packageJsonPath = path.join(workspacePath, 'package.json');
			const packageJson = JSON.parse(
				fs.readFileSync(packageJsonPath, 'utf-8')
			) as PackageJson;

			const currentVersion =
				packageJson[config.dependencyType]?.[config.packageName];

			if (!packageJson[config.dependencyType]) {
				packageJson[config.dependencyType] = {};
			}

			packageJson[config.dependencyType]![config.packageName] = config.version;

			changes.push({
				workspace: workspace.name,
				action: currentVersion ? 'update' : 'add',
				before: currentVersion,
				after: config.version,
			});

			if (!config.dryRun) {
				fs.writeFileSync(
					packageJsonPath,
					JSON.stringify(packageJson, null, 2) + '\n'
				);
			}
		}

		// Refresh workspace scanner to pick up changes
		if (!config.dryRun) {
			this.workspaceScanner.refresh();
		}

		return changes;
	}

	async removePackage(
		packageName: string,
		targetWorkspaces: string[],
		dryRun: boolean
	): Promise<
		Array<{
			workspace: string;
			type: string;
			version: string;
		}>
	> {
		const changes: Array<{ workspace: string; type: string; version: string }> =
			[];

		for (const workspacePath of targetWorkspaces) {
			const workspace = this.workspaceScanner.getWorkspaceByPath(workspacePath);
			if (!workspace) continue;

			const packageJsonPath = path.join(workspacePath, 'package.json');
			const packageJson = JSON.parse(
				fs.readFileSync(packageJsonPath, 'utf-8')
			) as PackageJson;

			['dependencies', 'devDependencies', 'peerDependencies'].forEach(
				(depType) => {
					const deps = packageJson[depType as keyof PackageJson] as
						| Record<string, string>
						| undefined;
					if (deps?.[packageName]) {
						changes.push({
							workspace: workspace.name,
							type: depType,
							version: deps[packageName],
						});

						if (!dryRun) {
							delete deps[packageName];
						}
					}
				}
			);

			if (!dryRun) {
				fs.writeFileSync(
					packageJsonPath,
					JSON.stringify(packageJson, null, 2) + '\n'
				);
			}
		}

		// Refresh workspace scanner to pick up changes
		if (!dryRun) {
			this.workspaceScanner.refresh();
		}

		return changes;
	}

	async syncPackageVersions(
		packageName: string,
		targetVersion: string,
		dryRun: boolean
	): Promise<ConflictResolution> {
		const versions = this.getPackageVersions(packageName);
		const changes: Array<{
			workspace: string;
			before: string;
			after: string;
			type: string;
		}> = [];

		for (const [version, workspaces] of versions.versions.entries()) {
			if (version === targetVersion) continue;

			for (const workspace of workspaces) {
				const packageJsonPath = path.join(workspace.path, 'package.json');
				const packageJson = JSON.parse(
					fs.readFileSync(packageJsonPath, 'utf-8')
				) as PackageJson;

				let depType = '';
				if (packageJson.dependencies?.[packageName]) {
					depType = 'dependencies';
					if (!dryRun) packageJson.dependencies[packageName] = targetVersion;
				} else if (packageJson.devDependencies?.[packageName]) {
					depType = 'devDependencies';
					if (!dryRun) packageJson.devDependencies[packageName] = targetVersion;
				} else if (packageJson.peerDependencies?.[packageName]) {
					depType = 'peerDependencies';
					if (!dryRun)
						packageJson.peerDependencies[packageName] = targetVersion;
				}

				changes.push({
					workspace: workspace.name,
					before: version,
					after: targetVersion,
					type: depType,
				});

				if (!dryRun) {
					fs.writeFileSync(
						packageJsonPath,
						JSON.stringify(packageJson, null, 2) + '\n'
					);
				}
			}
		}

		// Refresh workspace scanner to pick up changes
		if (!dryRun) {
			this.workspaceScanner.refresh();
		}

		return {
			packageName,
			targetVersion,
			changes,
		};
	}

	getPackageVersions(packageName: string): PackageVersionInfo {
		const versions = new Map<string, WorkspaceInfo[]>();

		this.workspaceScanner.getWorkspaces().forEach((workspace) => {
			const deps = {
				...workspace.packageJson.dependencies,
				...workspace.packageJson.devDependencies,
				...workspace.packageJson.peerDependencies,
			};

			if (deps[packageName]) {
				const version = deps[packageName];
				if (!versions.has(version)) {
					versions.set(version, []);
				}
				versions.get(version)!.push(workspace);
			}
		});

		return { packageName, versions };
	}

	getAllPackages(): string[] {
		const allPackages = new Set<string>();

		this.workspaceScanner.getWorkspaces().forEach((workspace) => {
			const deps = {
				...workspace.packageJson.dependencies,
				...workspace.packageJson.devDependencies,
				...workspace.packageJson.peerDependencies,
			};

			Object.keys(deps).forEach((pkg) => allPackages.add(pkg));
		});

		return Array.from(allPackages).sort();
	}

	findVersionConflicts(): PackageVersionInfo[] {
		const packageMap = new Map<string, Map<string, WorkspaceInfo[]>>();

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
				versionMap.get(version)!.push(workspace);
			});
		});

		// Return only packages with multiple versions (conflicts)
		return Array.from(packageMap.entries())
			.filter(([, versionMap]) => versionMap.size > 1)
			.map(([packageName, versions]) => ({ packageName, versions }))
			.sort((a, b) => a.packageName.localeCompare(b.packageName));
	}

	async detectPackageManager(): Promise<PackageManagerType> {
		const rootPath =
			this.workspaceScanner.getWorkspaces().find((w) => w.type === 'root')
				?.path || process.cwd();

		// Check for lock files to determine package manager
		if (
			fs.existsSync(path.join(rootPath, 'bun.lockb')) ||
			fs.existsSync(path.join(rootPath, 'bun.lock'))
		) {
			return 'bun';
		}
		if (fs.existsSync(path.join(rootPath, 'yarn.lock'))) {
			return 'yarn';
		}
		if (fs.existsSync(path.join(rootPath, 'pnpm-lock.yaml'))) {
			return 'pnpm';
		}

		return 'npm';
	}

	getInstallCommand(packageManager: PackageManagerType): string[] {
		switch (packageManager) {
			case 'bun':
				return ['bun', 'install'];
			case 'yarn':
				return ['yarn', 'install'];
			case 'pnpm':
				return ['pnpm', 'install'];
			default:
				return ['npm', 'install'];
		}
	}

	async installPackages(
		targetWorkspaces: string[]
	): Promise<InstallationResult> {
		return new Promise(async (resolve) => {
			try {
				const packageManager = await this.detectPackageManager();
				const installCommand = this.getInstallCommand(packageManager);
				const [command, ...args] = installCommand;

				// Check if it's a monorepo
				const rootWorkspace = this.workspaceScanner
					.getWorkspaces()
					.find((w) => w.type === 'root');
				const isMonorepo = rootWorkspace?.packageJson.workspaces !== undefined;

				const installPath = isMonorepo
					? rootWorkspace!.path
					: targetWorkspaces[0];

				const installProcess = spawn(command, args, {
					cwd: installPath,
					stdio: ['pipe', 'pipe', 'pipe'],
				});

				let stdout = '';
				let stderr = '';

				installProcess.stdout?.on('data', (data) => {
					stdout += data.toString();
				});

				installProcess.stderr?.on('data', (data) => {
					stderr += data.toString();
				});

				installProcess.on('close', (code) => {
					if (code === 0) {
						resolve({ success: true, output: stdout });
					} else {
						resolve({
							success: false,
							error: stderr || 'Installation failed',
							output: stdout,
						});
					}
				});

				// Timeout after 5 minutes
				setTimeout(() => {
					installProcess.kill();
					resolve({ success: false, error: 'Installation timeout' });
				}, 300000);
			} catch (error) {
				resolve({
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		});
	}

	async fetchLatestVersion(packageName: string): Promise<string | null> {
		return new Promise((resolve) => {
			const npmProcess = spawn('npm', ['view', packageName, 'version'], {
				stdio: ['pipe', 'pipe', 'pipe'],
			});

			let stdout = '';
			let stderr = '';

			npmProcess.stdout?.on('data', (data) => {
				stdout += data.toString();
			});

			npmProcess.stderr?.on('data', (data) => {
				stderr += data.toString();
			});

			npmProcess.on('close', (code) => {
				if (code === 0) {
					resolve(stdout.trim());
				} else {
					resolve(null);
				}
			});

			// Timeout after 10 seconds
			setTimeout(() => {
				npmProcess.kill();
				resolve(null);
			}, 10000);
		});
	}
}
