#!/usr/bin/env node

import {
	intro,
	outro,
	text,
	select,
	multiselect,
	confirm,
	spinner,
	note,
	cancel,
} from '@clack/prompts';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, relative } from 'path';
import { existsSync } from 'fs';
import pc from 'picocolors';

interface PackageJson {
	name?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

interface WorkspaceInfo {
	path: string;
	name: string;
	type: 'app' | 'package' | 'root';
	packageJson: PackageJson;
}

interface UpdateConfig {
	packageName: string;
	version: string;
	dependencyType: 'dependencies' | 'devDependencies' | 'peerDependencies';
	targetWorkspaces: string[];
	dryRun: boolean;
}

class PackageUpdater {
	private workspaces: WorkspaceInfo[] = [];
	private rootPath: string;

	constructor(rootPath: string = process.cwd()) {
		this.rootPath = rootPath;
	}

	async init() {
		console.clear();
		intro(pc.bgCyan(pc.black(' 📦 Workspace Version Aligner ')));
		await this.scanWorkspaces();
	}

	private async scanWorkspaces() {
		const s = spinner();
		s.start('🔍 Scanning workspace for package.json files...');

		try {
			// Add root workspace
			const rootPackageJsonPath = join(this.rootPath, 'package.json');
			if (existsSync(rootPackageJsonPath)) {
				const rootPackageJson = JSON.parse(
					await readFile(rootPackageJsonPath, 'utf-8')
				);
				this.workspaces.push({
					path: this.rootPath,
					name: rootPackageJson.name || 'root',
					type: 'root',
					packageJson: rootPackageJson,
				});
			}

			// Scan apps
			const appsPath = join(this.rootPath, 'apps');
			if (existsSync(appsPath)) {
				const apps = await readdir(appsPath);
				for (const app of apps) {
					const appPath = join(appsPath, app);
					const packageJsonPath = join(appPath, 'package.json');
					if (existsSync(packageJsonPath)) {
						const packageJson = JSON.parse(
							await readFile(packageJsonPath, 'utf-8')
						);
						this.workspaces.push({
							path: appPath,
							name: packageJson.name || app,
							type: 'app',
							packageJson,
						});
					}
				}
			}

			// Scan packages
			const packagesPath = join(this.rootPath, 'packages');
			if (existsSync(packagesPath)) {
				const packages = await readdir(packagesPath);
				for (const pkg of packages) {
					const pkgPath = join(packagesPath, pkg);
					const packageJsonPath = join(pkgPath, 'package.json');
					if (existsSync(packageJsonPath)) {
						const packageJson = JSON.parse(
							await readFile(packageJsonPath, 'utf-8')
						);
						this.workspaces.push({
							path: pkgPath,
							name: packageJson.name || pkg,
							type: 'package',
							packageJson,
						});
					}
				}
			}

			s.stop(`✅ Found ${this.workspaces.length} workspaces`);
		} catch (error) {
			s.stop('❌ Failed to scan workspaces');
			throw error;
		}
	}

	private displayWorkspaces() {
		const workspacesByType = this.workspaces.reduce((acc, workspace) => {
			if (!acc[workspace.type]) acc[workspace.type] = [];
			acc[workspace.type].push(workspace);
			return acc;
		}, {} as Record<string, WorkspaceInfo[]>);

		let display = '\n';

		Object.entries(workspacesByType).forEach(([type, workspaces]) => {
			const typeIcon = type === 'app' ? '📱' : type === 'package' ? '📦' : '🏠';
			display += pc.bold(pc.cyan(`${typeIcon} ${type.toUpperCase()}S:\n`));

			workspaces.forEach((workspace) => {
				const relativePath = relative(this.rootPath, workspace.path);
				display += `  ${pc.gray('├─')} ${pc.white(workspace.name)} ${pc.dim(
					`(${relativePath})\n`
				)}`;
			});
			display += '\n';
		});

		note(display, 'Available Workspaces');
	}

	async run() {
		try {
			await this.init();

			const action = await select({
				message: 'What would you like to do?',
				options: [
					{ value: 'add', label: '➕ Add/Update a package' },
					{ value: 'remove', label: '🗑️  Remove a package' },
					{ value: 'list', label: '📋 List all packages in workspaces' },
					{
						value: 'sync',
						label: '🔄 Sync package versions across workspaces',
					},
					{
						value: 'conflicts',
						label: '⚠️  Find and resolve version conflicts',
					},
					{
						value: 'install',
						label: '📦 Install packages in workspaces',
					},
				],
			});

			if (action === 'list') {
				await this.listPackages();
				process.exit(0);
			}

			if (action === 'add') {
				await this.addOrUpdatePackage();
			} else if (action === 'remove') {
				await this.removePackage();
			} else if (action === 'sync') {
				await this.syncPackageVersions();
			} else if (action === 'conflicts') {
				await this.findAndResolveConflicts();
			} else if (action === 'install') {
				await this.handleStandaloneInstall();
			}
		} catch (error) {
			if (error === undefined) {
				cancel('Operation cancelled');
				process.exit(0);
			}
			console.error(pc.red('Error:'), error);
			process.exit(1);
		}
	}

	private async handleStandaloneInstall() {
		this.displayWorkspaces();

		const scopeChoice = await select({
			message: 'Select installation scope:',
			options: [
				{ value: 'all', label: '🌍 All workspaces' },
				{ value: 'byType', label: '🎯 By workspace type (apps/packages)' },
				{ value: 'custom', label: '✨ Custom selection' },
			],
		});

		let targetWorkspaces: string[] = [];

		if (scopeChoice === 'all') {
			targetWorkspaces = this.workspaces.map((w) => w.path);
		} else if (scopeChoice === 'byType') {
			const typeChoice = await multiselect({
				message: 'Select workspace types:',
				options: [
					{ value: 'root', label: '🏠 Root workspace' },
					{ value: 'app', label: '📱 Apps' },
					{ value: 'package', label: '📦 Packages' },
				],
			});

			targetWorkspaces = this.workspaces
				.filter((w) => Array.isArray(typeChoice) && typeChoice.includes(w.type))
				.map((w) => w.path);
		} else {
			const selectedWorkspaces = await multiselect({
				message: 'Select specific workspaces:',
				options: this.workspaces.map((w) => ({
					value: w.path,
					label: `${this.getTypeIcon(w.type)} ${w.name} ${pc.dim(
						`(${relative(this.rootPath, w.path)})`
					)}`,
				})),
			});

			targetWorkspaces = selectedWorkspaces as string[];
		}

		if (targetWorkspaces.length === 0) {
			note('No workspaces selected for installation', 'Installation Cancelled');
			return;
		}

		const packageManager = await this.detectPackageManager();
		const installCommand = this.getInstallCommand(packageManager).join(' ');

		note(
			`\n🔧 Detected package manager: ${pc.green(
				packageManager
			)}\n📦 Install command: ${pc.cyan(installCommand)}\n`,
			'Installation Info'
		);

		const confirmInstall = await confirm({
			message: `Install packages in ${targetWorkspaces.length} workspace${
				targetWorkspaces.length > 1 ? 's' : ''
			}?`,
			initialValue: true,
		});

		if (confirmInstall) {
			await this.installPackages(targetWorkspaces);
			outro(pc.green('✨ Package installation completed successfully!'));
			process.exit(0);
		} else {
			await this.showManualInstallInstructions(targetWorkspaces);
			process.exit(0);
		}
	}

	private async addOrUpdatePackage() {
		this.displayWorkspaces();

		const packageName = await text({
			message: 'Enter package name:',
			placeholder: 'e.g., typescript, react, lodash',
			validate: (value) =>
				value.length === 0 ? 'Package name is required' : undefined,
		});

		// Fetch and display latest version info
		const latestVersionInfo = await this.fetchLatestVersionSimple(
			packageName as string
		);
		if (latestVersionInfo) {
			const latestInfo = `\n📋 Latest version on npm: ${pc.green(
				latestVersionInfo
			)}\n`;
			note(latestInfo, 'NPM Registry Info');
		}

		const version = await text({
			message: 'Enter package version:',
			placeholder: 'e.g., ^5.6.0, latest, ~4.0.0',
			defaultValue: latestVersionInfo || 'latest',
		});

		const dependencyType = await select({
			message: 'Select dependency type:',
			options: [
				{ value: 'devDependencies', label: '🔧 devDependencies' },
				{ value: 'dependencies', label: '📦 dependencies' },
				{ value: 'peerDependencies', label: '🤝 peerDependencies' },
			],
		});

		const scopeChoice = await select({
			message: 'Select update scope:',
			options: [
				{ value: 'all', label: '🌍 All workspaces' },
				{ value: 'byType', label: '🎯 By workspace type (apps/packages)' },
				{ value: 'custom', label: '✨ Custom selection' },
			],
		});

		let targetWorkspaces: string[] = [];

		if (scopeChoice === 'all') {
			targetWorkspaces = this.workspaces.map((w) => w.path);
		} else if (scopeChoice === 'byType') {
			const typeChoice = await multiselect({
				message: 'Select workspace types:',
				options: [
					{ value: 'root', label: '🏠 Root workspace' },
					{ value: 'app', label: '📱 Apps' },
					{ value: 'package', label: '📦 Packages' },
				],
			});

			targetWorkspaces = this.workspaces
				.filter((w) => Array.isArray(typeChoice) && typeChoice.includes(w.type))
				.map((w) => w.path);
		} else {
			const selectedWorkspaces = await multiselect({
				message: 'Select specific workspaces:',
				options: this.workspaces.map((w) => ({
					value: w.path,
					label: `${this.getTypeIcon(w.type)} ${w.name} ${pc.dim(
						`(${relative(this.rootPath, w.path)})`
					)}`,
				})),
			});

			targetWorkspaces = selectedWorkspaces as string[];
		}

		const dryRun = await confirm({
			message: 'Run in dry-run mode? (Preview changes without applying)',
			initialValue: true,
		});

		const config: UpdateConfig = {
			packageName: packageName as string,
			version: version as string,
			dependencyType: dependencyType as any,
			targetWorkspaces,
			dryRun: dryRun as boolean,
		};

		await this.executeUpdate(config);
	}

	private async removePackage() {
		this.displayWorkspaces();

		// First, find all packages across workspaces
		const allPackages = new Set<string>();
		this.workspaces.forEach((workspace) => {
			Object.keys(workspace.packageJson.dependencies || {}).forEach((pkg) =>
				allPackages.add(pkg)
			);
			Object.keys(workspace.packageJson.devDependencies || {}).forEach((pkg) =>
				allPackages.add(pkg)
			);
			Object.keys(workspace.packageJson.peerDependencies || {}).forEach((pkg) =>
				allPackages.add(pkg)
			);
		});

		const packageToRemove = await select({
			message: 'Select package to remove:',
			options: Array.from(allPackages)
				.sort()
				.map((pkg) => ({
					value: pkg,
					label: pkg,
				})),
		});

		const targetWorkspaces = await multiselect({
			message: 'Select workspaces to remove from:',
			options: this.workspaces
				.filter((w) => this.hasPackage(w, packageToRemove as string))
				.map((w) => ({
					value: w.path,
					label: `${this.getTypeIcon(w.type)} ${w.name} ${pc.dim(
						`(${relative(this.rootPath, w.path)})`
					)}`,
				})),
		});

		const dryRun = await confirm({
			message: 'Run in dry-run mode?',
			initialValue: true,
		});

		await this.executeRemoval(
			packageToRemove as string,
			targetWorkspaces as string[],
			dryRun as boolean
		);
	}

	private async syncPackageVersions() {
		const packageName = await text({
			message: 'Enter package name to sync:',
			placeholder: 'e.g., typescript, react',
		});

		// Find all versions of this package
		const versions = new Map<string, WorkspaceInfo[]>();
		this.workspaces.forEach((workspace) => {
			const deps = {
				...workspace.packageJson.dependencies,
				...workspace.packageJson.devDependencies,
			};
			if (deps[packageName as string]) {
				const version = deps[packageName as string];
				if (!versions.has(version)) {
					versions.set(version, []);
				}
				versions.get(version)!.push(workspace);
			}
		});

		if (versions.size === 0) {
			note(
				`Package "${String(packageName)}" not found in any workspace`,
				'No Package Found'
			);
			return;
		}

		if (versions.size === 1) {
			note(
				`Package "${String(packageName)}" already has consistent version: ${
					Array.from(versions.keys())[0]
				}`,
				'Already Synced'
			);
			return;
		}

		// Display current versions
		let versionDisplay = '\n';
		versions.forEach((workspaces, version) => {
			versionDisplay += pc.yellow(`Version ${version}:\n`);
			workspaces.forEach((w) => {
				versionDisplay += `  ${pc.gray('├─')} ${w.name}\n`;
			});
			versionDisplay += '\n';
		});

		note(versionDisplay, `Current versions of "${String(packageName)}"`);

		const targetVersion = await select({
			message: 'Select version to sync to:',
			options: Array.from(versions.keys()).map((version) => ({
				value: version,
				label: `${version} (used in ${versions.get(version)!.length} workspace${
					versions.get(version)!.length > 1 ? 's' : ''
				})`,
			})),
		});

		const dryRun = await confirm({
			message: 'Run in dry-run mode?',
			initialValue: true,
		});

		await this.executeSyncVersions(
			packageName as string,
			targetVersion as string,
			versions,
			dryRun as boolean
		);
	}

	private async listPackages() {
		const packageMap = new Map<string, Map<string, WorkspaceInfo[]>>();

		this.workspaces.forEach((workspace) => {
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

		let display = '\n';
		const sortedPackages = Array.from(packageMap.entries()).sort(([a], [b]) =>
			a.localeCompare(b)
		);

		sortedPackages.forEach(([packageName, versionMap]) => {
			display += pc.bold(pc.cyan(`📦 ${packageName}\n`));

			Array.from(versionMap.entries()).forEach(([version, workspaces]) => {
				display += `  ${pc.yellow(version)} ${pc.dim(
					`(${workspaces.length} workspace${
						workspaces.length > 1 ? 's' : ''
					})\n`
				)}`;
				workspaces.forEach((workspace) => {
					display += `    ${pc.gray('├─')} ${workspace.name}\n`;
				});
			});
			display += '\n';
		});

		note(display, 'Package Overview');
	}

	private async executeUpdate(config: UpdateConfig) {
		const s = spinner();
		s.start(config.dryRun ? 'Previewing changes...' : 'Updating packages...');

		const changes: Array<{
			workspace: string;
			action: string;
			before?: string;
			after: string;
		}> = [];

		try {
			for (const workspacePath of config.targetWorkspaces) {
				const workspace = this.workspaces.find((w) => w.path === workspacePath);
				if (!workspace) continue;

				const packageJsonPath = join(workspacePath, 'package.json');
				const packageJson = JSON.parse(
					await readFile(packageJsonPath, 'utf-8')
				);

				const currentVersion =
					packageJson[config.dependencyType]?.[config.packageName];

				if (!packageJson[config.dependencyType]) {
					packageJson[config.dependencyType] = {};
				}

				packageJson[config.dependencyType][config.packageName] = config.version;

				changes.push({
					workspace: workspace.name,
					action: currentVersion ? 'update' : 'add',
					before: currentVersion,
					after: config.version,
				});

				if (!config.dryRun) {
					await writeFile(
						packageJsonPath,
						JSON.stringify(packageJson, null, 2) + '\n'
					);
				}
			}

			s.stop(config.dryRun ? '👀 Preview completed' : '✅ Update completed');

			// Display changes
			let changesDisplay = '\n';
			changes.forEach((change) => {
				const icon = change.action === 'add' ? '➕' : '📝';
				const action =
					change.action === 'add'
						? 'Added'
						: `Updated ${pc.dim(change.before!)} → `;
				changesDisplay += `${icon} ${change.workspace}: ${action}${pc.green(
					change.after
				)}\n`;
			});

			note(
				changesDisplay,
				config.dryRun ? 'Preview Changes' : 'Applied Changes'
			);

			if (config.dryRun) {
				const apply = await confirm({
					message: 'Apply these changes?',
					initialValue: false,
				});

				if (apply) {
					await this.executeUpdate({ ...config, dryRun: false });
				}
			} else {
				// Ask if user wants to install packages after successful update
				const shouldInstall = await confirm({
					message: 'Install packages now? (Recommended after package changes)',
					initialValue: true,
				});

				if (shouldInstall) {
					await this.installPackages(config.targetWorkspaces);
				}

				outro(pc.green('✨ Package update completed successfully!'));
				process.exit(0);
			}
		} catch (error) {
			s.stop('❌ Update failed');
			throw error;
		}
	}

	private async executeRemoval(
		packageName: string,
		targetWorkspaces: string[],
		dryRun: boolean
	) {
		const s = spinner();
		s.start(dryRun ? 'Previewing removals...' : 'Removing packages...');

		const changes: Array<{ workspace: string; type: string; version: string }> =
			[];

		try {
			for (const workspacePath of targetWorkspaces) {
				const workspace = this.workspaces.find((w) => w.path === workspacePath);
				if (!workspace) continue;

				const packageJsonPath = join(workspacePath, 'package.json');
				const packageJson = JSON.parse(
					await readFile(packageJsonPath, 'utf-8')
				);

				['dependencies', 'devDependencies', 'peerDependencies'].forEach(
					(depType) => {
						if (packageJson[depType]?.[packageName]) {
							changes.push({
								workspace: workspace.name,
								type: depType,
								version: packageJson[depType][packageName],
							});

							if (!dryRun) {
								delete packageJson[depType][packageName];
							}
						}
					}
				);

				if (!dryRun) {
					await writeFile(
						packageJsonPath,
						JSON.stringify(packageJson, null, 2) + '\n'
					);
				}
			}

			s.stop(dryRun ? '👀 Preview completed' : '✅ Removal completed');

			let changesDisplay = '\n';
			changes.forEach((change) => {
				changesDisplay += `🗑️  ${change.workspace}: Removed from ${
					change.type
				} ${pc.dim(`(${change.version})`)}\n`;
			});

			note(changesDisplay, dryRun ? 'Preview Removals' : 'Applied Removals');

			if (dryRun) {
				const apply = await confirm({
					message: 'Apply these changes?',
					initialValue: false,
				});

				if (apply) {
					await this.executeRemoval(packageName, targetWorkspaces, false);
				}
			} else {
				// Ask if user wants to install packages after successful removal
				const shouldInstall = await confirm({
					message:
						'Update package installations? (Recommended after removing packages)',
					initialValue: true,
				});

				if (shouldInstall) {
					await this.installPackages(targetWorkspaces);
				}

				outro(pc.green('✨ Package removal completed successfully!'));
				process.exit(0);
			}
		} catch (error) {
			s.stop('❌ Removal failed');
			throw error;
		}
	}

	private async executeSyncVersions(
		packageName: string,
		targetVersion: string,
		versions: Map<string, WorkspaceInfo[]>,
		dryRun: boolean
	) {
		const s = spinner();
		s.start(dryRun ? 'Previewing sync...' : 'Syncing versions...');

		const changes: Array<{
			workspace: string;
			before: string;
			after: string;
			type: string;
		}> = [];

		try {
			for (const [version, workspaces] of versions.entries()) {
				if (version === targetVersion) continue;

				for (const workspace of workspaces) {
					const packageJsonPath = join(workspace.path, 'package.json');
					const packageJson = JSON.parse(
						await readFile(packageJsonPath, 'utf-8')
					);

					let depType = '';
					if (packageJson.dependencies?.[packageName]) {
						depType = 'dependencies';
						if (!dryRun) packageJson.dependencies[packageName] = targetVersion;
					} else if (packageJson.devDependencies?.[packageName]) {
						depType = 'devDependencies';
						if (!dryRun)
							packageJson.devDependencies[packageName] = targetVersion;
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
						await writeFile(
							packageJsonPath,
							JSON.stringify(packageJson, null, 2) + '\n'
						);
					}
				}
			}

			s.stop(dryRun ? '👀 Preview completed' : '✅ Sync completed');

			let changesDisplay = '\n';
			changes.forEach((change) => {
				changesDisplay += `🔄 ${change.workspace}: ${pc.dim(
					change.before
				)} → ${pc.green(change.after)} ${pc.gray(`(${change.type})`)}\n`;
			});

			note(changesDisplay, dryRun ? 'Preview Sync' : 'Applied Sync');

			if (dryRun) {
				const apply = await confirm({
					message: 'Apply these changes?',
					initialValue: false,
				});

				if (apply) {
					await this.executeSyncVersions(
						packageName,
						targetVersion,
						versions,
						false
					);
				}
			} else {
				// Ask if user wants to install packages after successful sync
				const shouldInstall = await confirm({
					message: 'Install packages now? (Recommended after version changes)',
					initialValue: true,
				});

				if (shouldInstall) {
					const allWorkspaces = Array.from(versions.values())
						.flat()
						.map((w) => w.path);
					await this.installPackages(allWorkspaces);
				}

				outro(pc.green('✨ Version sync completed successfully!'));
				process.exit(0);
			}
		} catch (error) {
			s.stop('❌ Sync failed');
			throw error;
		}
	}

	private async findAndResolveConflicts() {
		const s = spinner();
		s.start('🔍 Analyzing package versions across workspaces...');

		// Build a comprehensive package version map
		const packageVersionMap = new Map<string, Map<string, WorkspaceInfo[]>>();

		this.workspaces.forEach((workspace) => {
			const allDeps = {
				...workspace.packageJson.dependencies,
				...workspace.packageJson.devDependencies,
				...workspace.packageJson.peerDependencies,
			};

			Object.entries(allDeps).forEach(([packageName, version]) => {
				if (!packageVersionMap.has(packageName)) {
					packageVersionMap.set(packageName, new Map());
				}
				const versionMap = packageVersionMap.get(packageName)!;
				if (!versionMap.has(version)) {
					versionMap.set(version, []);
				}
				versionMap.get(version)!.push(workspace);
			});
		});

		// Find packages with multiple versions (conflicts)
		const conflicts = Array.from(packageVersionMap.entries())
			.filter(([, versionMap]) => versionMap.size > 1)
			.sort(([a], [b]) => a.localeCompare(b));

		s.stop('✅ Analysis completed');

		if (conflicts.length === 0) {
			note(
				'🎉 No version conflicts found! All packages have consistent versions across workspaces.',
				'All Clear'
			);
			process.exit(0);
		}

		// Display conflicts summary
		let conflictsSummary = '\n';
		conflictsSummary += pc.red(
			`Found ${conflicts.length} package${
				conflicts.length > 1 ? 's' : ''
			} with version conflicts:\n\n`
		);

		conflicts.forEach(([packageName, versionMap]) => {
			conflictsSummary += pc.bold(pc.yellow(`📦 ${packageName}\n`));
			Array.from(versionMap.entries()).forEach(([version, workspaces]) => {
				conflictsSummary += `  ${pc.cyan(version)} ${pc.dim(
					`(${workspaces.length} workspace${
						workspaces.length > 1 ? 's' : ''
					})\n`
				)}`;
				workspaces.forEach((workspace) => {
					conflictsSummary += `    ${pc.gray('├─')} ${workspace.name}\n`;
				});
			});
			conflictsSummary += '\n';
		});

		note(conflictsSummary, 'Version Conflicts Detected');

		const resolutionChoice = await select({
			message: 'How would you like to resolve conflicts?',
			options: [
				{ value: 'all', label: '🔄 Resolve all conflicts interactively' },
				{ value: 'specific', label: '🎯 Choose specific packages to resolve' },
				{ value: 'auto', label: '⚡ Auto-resolve to most common versions' },
				{ value: 'latest', label: '🚀 Auto-resolve all to latest versions' },
			],
		});

		if (resolutionChoice === 'all') {
			await this.resolveAllConflicts(conflicts);
		} else if (resolutionChoice === 'specific') {
			await this.resolveSpecificConflicts(conflicts);
		} else if (resolutionChoice === 'auto') {
			await this.autoResolveToMostCommon(conflicts);
		} else if (resolutionChoice === 'latest') {
			await this.autoResolveToLatest(conflicts);
		}
	}

	private async resolveAllConflicts(
		conflicts: Array<[string, Map<string, WorkspaceInfo[]>]>
	) {
		for (const [packageName, versionMap] of conflicts) {
			await this.resolvePackageConflict(packageName, versionMap);
		}
		outro(pc.green('✨ All conflicts resolved successfully!'));
		process.exit(0);
	}

	private async resolveSpecificConflicts(
		conflicts: Array<[string, Map<string, WorkspaceInfo[]>]>
	) {
		const selectedPackages = await multiselect({
			message: 'Select packages to resolve:',
			options: conflicts.map(([packageName, versionMap]) => ({
				value: packageName,
				label: `📦 ${packageName} ${pc.dim(`(${versionMap.size} versions)`)}`,
			})),
		});

		const selectedConflicts = conflicts.filter(([packageName]) =>
			(selectedPackages as string[]).includes(packageName)
		);

		for (const [packageName, versionMap] of selectedConflicts) {
			await this.resolvePackageConflict(packageName, versionMap);
		}

		outro(pc.green('✨ Selected conflicts resolved successfully!'));
		process.exit(0);
	}

	private async resolvePackageConflict(
		packageName: string,
		versionMap: Map<string, WorkspaceInfo[]>
	) {
		// Display current versions for this package
		let versionDisplay = '\n';
		versionDisplay += pc.bold(pc.cyan(`📦 Resolving: ${packageName}\n\n`));

		Array.from(versionMap.entries()).forEach(([version, workspaces]) => {
			versionDisplay += pc.yellow(`Version ${version}:\n`);
			workspaces.forEach((workspace) => {
				versionDisplay += `  ${pc.gray('├─')} ${workspace.name}\n`;
			});
			versionDisplay += '\n';
		});

		note(versionDisplay, `Conflict Resolution for ${packageName}`);

		// Fetch latest version from npm
		const latestVersionInfo = await this.fetchLatestVersion(
			packageName,
			versionMap
		);

		// Display npm latest version info if available
		if (latestVersionInfo) {
			const latestInfo = `\n📋 Latest version on npm: ${pc.green(
				latestVersionInfo.version
			)}${
				latestVersionInfo.isNewer
					? pc.yellow(' 🆕 (newer than current versions)')
					: pc.gray(' (already in use)')
			}\n`;
			note(latestInfo, 'NPM Registry Info');
		}

		const resolutionOptions = [
			...Array.from(versionMap.keys()).map((version) => ({
				value: version,
				label: `${version} ${pc.dim(
					`(used in ${versionMap.get(version)!.length} workspace${
						versionMap.get(version)!.length > 1 ? 's' : ''
					})`
				)}`,
			})),
			...(latestVersionInfo
				? [
						{
							value: latestVersionInfo.version,
							label: `${latestVersionInfo.version} ${pc.green(
								'(latest from npm)'
							)} ${latestVersionInfo.isNewer ? pc.yellow('🆕') : ''}`,
						},
				  ]
				: []),
			{ value: 'custom', label: '✨ Enter custom version' },
			{ value: 'skip', label: '⏭️  Skip this package' },
		];

		const targetVersion = await select({
			message: `Select target version for ${packageName}:`,
			options: resolutionOptions,
		});

		if (targetVersion === 'skip') {
			note(`Skipped resolution for ${packageName}`, 'Skipped');
			return;
		}

		let finalVersion = targetVersion as string;

		if (targetVersion === 'custom') {
			const customVersion = await text({
				message: `Enter custom version for ${packageName}:`,
				placeholder: 'e.g., ^5.6.0, latest, ~4.0.0',
				validate: (value) =>
					value.length === 0 ? 'Version is required' : undefined,
			});
			finalVersion = customVersion as string;
		}

		const dryRun = await confirm({
			message: `Preview changes for ${packageName}?`,
			initialValue: true,
		});

		await this.executeSyncVersions(
			packageName,
			finalVersion,
			versionMap,
			dryRun as boolean
		);

		// If not in dry run mode, ask about installation
		if (!(dryRun as boolean)) {
			const shouldInstall = await confirm({
				message: 'Install packages now? (Recommended after version changes)',
				initialValue: true,
			});

			if (shouldInstall) {
				const allWorkspaces = Array.from(versionMap.values())
					.flat()
					.map((w) => w.path);
				await this.installPackages(allWorkspaces);
			}
		}
	}

	private async autoResolveToMostCommon(
		conflicts: Array<[string, Map<string, WorkspaceInfo[]>]>
	) {
		const s = spinner();
		s.start('🔄 Auto-resolving to most common versions...');

		const resolutions: Array<{
			packageName: string;
			targetVersion: string;
			changes: number;
		}> = [];

		try {
			for (const [packageName, versionMap] of conflicts) {
				// Find the version used by the most workspaces
				let mostCommonVersion = '';
				let maxCount = 0;

				Array.from(versionMap.entries()).forEach(([version, workspaces]) => {
					if (workspaces.length > maxCount) {
						maxCount = workspaces.length;
						mostCommonVersion = version;
					}
				});

				// Count how many workspaces need to be changed
				const changesNeeded =
					Array.from(versionMap.values()).reduce(
						(total, workspaces) => total + workspaces.length,
						0
					) - maxCount;

				resolutions.push({
					packageName,
					targetVersion: mostCommonVersion,
					changes: changesNeeded,
				});

				// Apply the resolution
				await this.executeSyncVersions(
					packageName,
					mostCommonVersion,
					versionMap,
					false
				);
			}

			s.stop('✅ Auto-resolution completed');

			// Display summary
			let summary = '\n';
			resolutions.forEach(({ packageName, targetVersion, changes }) => {
				summary += `📦 ${packageName}: ${pc.green(targetVersion)} ${pc.dim(
					`(${changes} changes)`
				)}\n`;
			});

			note(summary, 'Auto-Resolution Summary');
			outro(
				pc.green('✨ All conflicts auto-resolved to most common versions!')
			);

			// Ask if user wants to install packages after auto-resolution
			const shouldInstall = await confirm({
				message:
					'Install packages now? (Recommended after resolving conflicts)',
				initialValue: true,
			});

			if (shouldInstall) {
				const allWorkspaces = conflicts.flatMap(([, versionMap]) =>
					Array.from(versionMap.values())
						.flat()
						.map((w) => w.path)
				);
				// Remove duplicates
				const uniqueWorkspaces = [...new Set(allWorkspaces)];
				await this.installPackages(uniqueWorkspaces);
			}
			process.exit(0);
		} catch (error) {
			s.stop('❌ Auto-resolution failed');
			throw error;
		}
	}

	private async autoResolveToLatest(
		conflicts: Array<[string, Map<string, WorkspaceInfo[]>]>
	) {
		const confirmLatest = await confirm({
			message: `This will update ${conflicts.length} package${
				conflicts.length > 1 ? 's' : ''
			} to "latest" version. Continue?`,
			initialValue: false,
		});

		if (!confirmLatest) {
			note('Auto-resolution cancelled', 'Cancelled');
			return;
		}

		const s = spinner();
		s.start('🚀 Auto-resolving to latest versions...');

		try {
			for (const [packageName, versionMap] of conflicts) {
				await this.executeSyncVersions(
					packageName,
					'latest',
					versionMap,
					false
				);
			}

			s.stop('✅ Auto-resolution to latest completed');

			let summary = '\n';
			conflicts.forEach(([packageName]) => {
				summary += `📦 ${packageName}: ${pc.green('latest')}\n`;
			});

			note(summary, 'Latest Version Resolution Summary');
			outro(pc.green('✨ All conflicts resolved to latest versions!'));

			// Ask if user wants to install packages after latest resolution
			const shouldInstall = await confirm({
				message:
					'Install packages now? (Recommended after updating to latest versions)',
				initialValue: true,
			});

			if (shouldInstall) {
				const allWorkspaces = conflicts.flatMap(([, versionMap]) =>
					Array.from(versionMap.values())
						.flat()
						.map((w) => w.path)
				);
				// Remove duplicates
				const uniqueWorkspaces = [...new Set(allWorkspaces)];
				await this.installPackages(uniqueWorkspaces);
			}
			process.exit(0);
		} catch (error) {
			s.stop('❌ Auto-resolution failed');
			throw error;
		}
	}

	private hasPackage(workspace: WorkspaceInfo, packageName: string): boolean {
		const allDeps = {
			...workspace.packageJson.dependencies,
			...workspace.packageJson.devDependencies,
			...workspace.packageJson.peerDependencies,
		};
		return packageName in allDeps;
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

	private async fetchLatestVersion(
		packageName: string,
		versionMap: Map<string, WorkspaceInfo[]>
	): Promise<{ version: string; isNewer: boolean } | null> {
		try {
			const s = spinner();
			s.start(`🔍 Fetching latest version for ${packageName}...`);

			// Use npm view command to get latest version
			const { spawn } = await import('child_process');

			const result = await new Promise<string>((resolve, reject) => {
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
						reject(new Error(stderr || 'Failed to fetch package info'));
					}
				});

				// Timeout after 10 seconds
				setTimeout(() => {
					npmProcess.kill();
					reject(new Error('Timeout: npm request took too long'));
				}, 10000);
			});

			const latestVersion = result.trim();

			// Check if this version is newer than any current versions
			const currentVersions = Array.from(versionMap.keys());
			const isNewer = this.isVersionNewer(latestVersion, currentVersions);

			s.stop(`✅ Latest version: ${latestVersion}`);

			return {
				version: latestVersion,
				isNewer,
			};
		} catch (error) {
			// Silently fail and continue without latest version info
			return null;
		}
	}

	private async fetchLatestVersionSimple(
		packageName: string
	): Promise<string | null> {
		try {
			// Use npm view command to get latest version
			const { spawn } = await import('child_process');

			const result = await new Promise<string>((resolve, reject) => {
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
						reject(new Error(stderr || 'Failed to fetch package info'));
					}
				});

				// Timeout after 10 seconds
				setTimeout(() => {
					npmProcess.kill();
					reject(new Error('Timeout: npm request took too long'));
				}, 10000);
			});

			return result.trim();
		} catch (error) {
			// Silently fail and continue without latest version info
			return null;
		}
	}

	private isVersionNewer(
		latestVersion: string,
		currentVersions: string[]
	): boolean {
		// Simple check - if the latest version is not in current versions, consider it newer
		// This is a basic implementation. For more accurate comparison, you'd need semver
		const cleanLatest = latestVersion.replace(/[\^~]/g, '');
		const cleanCurrents = currentVersions.map((v) => v.replace(/[\^~]/g, ''));

		return !cleanCurrents.includes(cleanLatest);
	}

	private async installPackages(targetWorkspaces: string[]) {
		const s = spinner();
		s.start('📦 Installing packages...');

		try {
			// Check if we're in a workspace with package manager preference
			const packageManager = await this.detectPackageManager();

			// Group workspaces by their location for more efficient installation
			const workspaceGroups = await this.groupWorkspacesByLocation(
				targetWorkspaces
			);

			for (const { path, workspaces } of workspaceGroups) {
				const { spawn } = await import('child_process');

				const installCommand = this.getInstallCommand(packageManager);
				const [command, ...args] = installCommand;

				s.message(`Installing in ${path}...`);

				await new Promise<void>((resolve, reject) => {
					const installProcess = spawn(command, args, {
						cwd: path,
						stdio: ['inherit', 'pipe', 'pipe'],
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
							resolve();
						} else {
							reject(
								new Error(
									`Installation failed in ${path}: ${stderr || 'Unknown error'}`
								)
							);
						}
					});

					// Timeout after 5 minutes
					setTimeout(() => {
						installProcess.kill();
						reject(new Error(`Installation timeout in ${path}`));
					}, 300000);
				});
			}

			s.stop('✅ Package installation completed');
		} catch (error) {
			s.stop('❌ Package installation failed');
			note(
				`Installation error: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
				'Installation Failed'
			);

			const retry = await confirm({
				message: 'Would you like to try installing manually?',
				initialValue: false,
			});

			if (retry) {
				await this.showManualInstallInstructions(targetWorkspaces);
				process.exit(0);
			} else {
				process.exit(1);
			}
		}
	}

	private async detectPackageManager(): Promise<
		'bun' | 'npm' | 'yarn' | 'pnpm'
	> {
		const { existsSync } = await import('fs');

		// Check for lock files to determine package manager
		if (
			existsSync(join(this.rootPath, 'bun.lockb')) ||
			existsSync(join(this.rootPath, 'bun.lock'))
		) {
			return 'bun';
		}
		if (existsSync(join(this.rootPath, 'yarn.lock'))) {
			return 'yarn';
		}
		if (existsSync(join(this.rootPath, 'pnpm-lock.yaml'))) {
			return 'pnpm';
		}

		// Default to npm
		return 'npm';
	}

	private getInstallCommand(packageManager: string): string[] {
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

	private async groupWorkspacesByLocation(
		targetWorkspaces: string[]
	): Promise<Array<{ path: string; workspaces: string[] }>> {
		// For monorepos, we usually want to install from the root
		// But we'll also support individual workspace installation
		const groups = new Map<string, string[]>();

		// Check if this is a monorepo (has workspaces in package.json)
		const rootPackageJsonPath = join(this.rootPath, 'package.json');
		if (existsSync(rootPackageJsonPath)) {
			try {
				const fs = await import('fs');
				const rootPackageJson = JSON.parse(
					fs.readFileSync(rootPackageJsonPath, 'utf-8')
				);
				if (rootPackageJson.workspaces) {
					// It's a monorepo, install from root
					groups.set(this.rootPath, targetWorkspaces);
					return Array.from(groups.entries()).map(([path, workspaces]) => ({
						path,
						workspaces,
					}));
				}
			} catch (error) {
				// Continue with individual installations
			}
		}

		// Not a monorepo, group by workspace directories
		targetWorkspaces.forEach((workspace) => {
			const workspaceDir = workspace;
			if (!groups.has(workspaceDir)) {
				groups.set(workspaceDir, []);
			}
			groups.get(workspaceDir)!.push(workspace);
		});

		return Array.from(groups.entries()).map(([path, workspaces]) => ({
			path,
			workspaces,
		}));
	}

	private async showManualInstallInstructions(targetWorkspaces: string[]) {
		const packageManager = await this.detectPackageManager();
		const installCommand = this.getInstallCommand(packageManager).join(' ');

		let instructions = '\n';
		instructions += pc.bold(pc.yellow('Manual Installation Instructions:\n\n'));

		const groups = await this.groupWorkspacesByLocation(targetWorkspaces);

		groups.forEach(({ path }) => {
			const relativePath = relative(this.rootPath, path);
			instructions += pc.cyan(`📁 ${relativePath || 'root'}:\n`);
			instructions += pc.gray(`   cd ${relativePath || '.'}\n`);
			instructions += pc.green(`   ${installCommand}\n\n`);
		});

		note(instructions, 'Manual Installation');
	}
}

// Run the script
const updater = new PackageUpdater();
updater.run().catch(console.error);
