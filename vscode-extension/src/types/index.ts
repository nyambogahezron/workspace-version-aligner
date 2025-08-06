export interface PackageJson {
	name?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	workspaces?: string[] | { packages: string[] };
}

export interface WorkspaceInfo {
	path: string;
	name: string;
	type: 'app' | 'package' | 'root';
	packageJson: PackageJson;
	relativePath: string;
}

export interface UpdateConfig {
	packageName: string;
	version: string;
	dependencyType: 'dependencies' | 'devDependencies' | 'peerDependencies';
	targetWorkspaces: string[];
	dryRun: boolean;
}

export interface PackageVersionInfo {
	packageName: string;
	versions: Map<string, WorkspaceInfo[]>;
}

export interface ConflictResolution {
	packageName: string;
	targetVersion: string;
	changes: Array<{
		workspace: string;
		before: string;
		after: string;
		type: string;
	}>;
}

export type PackageManagerType = 'bun' | 'npm' | 'yarn' | 'pnpm';

export interface InstallationResult {
	success: boolean;
	error?: string;
	output?: string;
}
