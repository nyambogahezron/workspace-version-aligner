import * as vscode from 'vscode';

export function getWebviewContent(
	webview: vscode.Webview,
	extensionUri: vscode.Uri
): string {
	const toolkitUri = webview.asWebviewUri(
		vscode.Uri.joinPath(
			extensionUri,
			'node_modules',
			'@vscode/webview-ui-toolkit',
			'dist',
			'toolkit.js'
		)
	);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Workspace Version Aligner</title>
	<script type="module" src="${toolkitUri}"></script>
	<style>
		body {
			padding: 20px;
			font-family: var(--vscode-font-family);
		}
		
		.header {
			margin-bottom: 20px;
			padding-bottom: 15px;
			border-bottom: 1px solid var(--vscode-panel-border);
		}
		
		.header h1 {
			margin: 0;
			color: var(--vscode-foreground);
			display: flex;
			align-items: center;
			gap: 10px;
		}
		
		.section {
			margin-bottom: 30px;
			padding: 20px;
			border: 1px solid var(--vscode-panel-border);
			border-radius: 6px;
			background-color: var(--vscode-editor-background);
		}
		
		.section h2 {
			margin-top: 0;
			color: var(--vscode-foreground);
			display: flex;
			align-items: center;
			gap: 8px;
		}
		
		.workspace-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
			gap: 15px;
			margin-top: 15px;
		}
		
		.workspace-card {
			padding: 15px;
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
			background-color: var(--vscode-input-background);
		}
		
		.workspace-card h3 {
			margin: 0 0 8px 0;
			font-size: 14px;
			display: flex;
			align-items: center;
			gap: 6px;
		}
		
		.workspace-card p {
			margin: 0;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}
		
		.conflict-item {
			padding: 15px;
			margin: 10px 0;
			border: 1px solid var(--vscode-errorBorder);
			border-radius: 4px;
			background-color: var(--vscode-inputValidation-errorBackground);
		}
		
		.conflict-item h3 {
			margin: 0 0 10px 0;
			color: var(--vscode-errorForeground);
			display: flex;
			align-items: center;
			gap: 6px;
		}
		
		.version-list {
			margin: 10px 0;
		}
		
		.version-item {
			margin: 5px 0;
			padding: 8px;
			background-color: var(--vscode-input-background);
			border-radius: 3px;
			font-size: 12px;
		}
		
		.form-group {
			margin: 15px 0;
		}
		
		.form-group label {
			display: block;
			margin-bottom: 5px;
			font-weight: bold;
			color: var(--vscode-foreground);
		}
		
		.checkbox-group {
			margin: 10px 0;
			max-height: 200px;
			overflow-y: auto;
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
			padding: 10px;
		}
		
		.checkbox-item {
			display: flex;
			align-items: center;
			margin: 5px 0;
			font-size: 13px;
		}
		
		.checkbox-item input {
			margin-right: 8px;
		}
		
		.button-group {
			display: flex;
			gap: 10px;
			margin-top: 15px;
		}
		
		.loading {
			display: inline-flex;
			align-items: center;
			gap: 8px;
		}
		
		.spinner {
			width: 16px;
			height: 16px;
			border: 2px solid var(--vscode-progressBar-background);
			border-top: 2px solid var(--vscode-progressBar-foreground);
			border-radius: 50%;
			animation: spin 1s linear infinite;
		}
		
		@keyframes spin {
			0% { transform: rotate(0deg); }
			100% { transform: rotate(360deg); }
		}
		
		.hidden {
			display: none;
		}
		
		.success {
			color: var(--vscode-terminal-ansiGreen);
		}
		
		.error {
			color: var(--vscode-errorForeground);
		}
		
		.warning {
			color: var(--vscode-warningForeground);
		}
		
		.status-message {
			padding: 10px;
			margin: 10px 0;
			border-radius: 4px;
			font-size: 13px;
		}
		
		.status-success {
			background-color: var(--vscode-inputValidation-infoBackground);
			border: 1px solid var(--vscode-inputValidation-infoBorder);
			color: var(--vscode-inputValidation-infoForeground);
		}
		
		.status-error {
			background-color: var(--vscode-inputValidation-errorBackground);
			border: 1px solid var(--vscode-inputValidation-errorBorder);
			color: var(--vscode-inputValidation-errorForeground);
		}
		
		.status-warning {
			background-color: var(--vscode-inputValidation-warningBackground);
			border: 1px solid var(--vscode-inputValidation-warningBorder);
			color: var(--vscode-inputValidation-warningForeground);
		}
	</style>
</head>
<body>
	<div class="header">
		<h1>📦 Workspace Version Aligner</h1>
		<p>Manage package versions across your monorepo workspaces</p>
	</div>

	<!-- Status Messages -->
	<div id="statusContainer"></div>

	<!-- Workspaces Section -->
	<div class="section">
		<h2>🏗️ Workspaces</h2>
		<div class="button-group">
			<vscode-button id="scanWorkspaces">🔍 Scan Workspaces</vscode-button>
		</div>
		<div id="workspacesContainer" class="workspace-grid">
			<div class="loading">
				<div class="spinner"></div>
				<span>Loading workspaces...</span>
			</div>
		</div>
	</div>

	<!-- Add/Update Package Section -->
	<div class="section">
		<h2>➕ Add/Update Package</h2>
		<form id="addPackageForm">
			<div class="form-group">
				<label for="packageName">Package Name:</label>
				<vscode-text-field id="packageName" placeholder="e.g., typescript, react, lodash"></vscode-text-field>
			</div>
			
			<div class="form-group">
				<label for="packageVersion">Version:</label>
				<vscode-text-field id="packageVersion" placeholder="e.g., ^5.6.0, latest, ~4.0.0" value="latest"></vscode-text-field>
				<small id="latestVersionInfo" class="hidden"></small>
			</div>
			
			<div class="form-group">
				<label for="dependencyType">Dependency Type:</label>
				<vscode-dropdown id="dependencyType">
					<vscode-option value="devDependencies">devDependencies</vscode-option>
					<vscode-option value="dependencies">dependencies</vscode-option>
					<vscode-option value="peerDependencies">peerDependencies</vscode-option>
				</vscode-dropdown>
			</div>
			
			<div class="form-group">
				<label>Target Workspaces:</label>
				<div id="workspaceSelection" class="checkbox-group">
					<!-- Populated dynamically -->
				</div>
			</div>
			
			<div class="form-group">
				<vscode-checkbox id="dryRun" checked>Dry Run (Preview changes)</vscode-checkbox>
			</div>
			
			<div class="button-group">
				<vscode-button id="addPackageBtn">➕ Add/Update Package</vscode-button>
			</div>
		</form>
	</div>

	<!-- Remove Package Section -->
	<div class="section">
		<h2>🗑️ Remove Package</h2>
		<form id="removePackageForm">
			<div class="form-group">
				<label for="packageToRemove">Package to Remove:</label>
				<vscode-dropdown id="packageToRemove">
					<!-- Populated dynamically -->
				</vscode-dropdown>
			</div>
			
			<div class="form-group">
				<label>Target Workspaces:</label>
				<div id="removeWorkspaceSelection" class="checkbox-group">
					<!-- Populated dynamically -->
				</div>
			</div>
			
			<div class="form-group">
				<vscode-checkbox id="removeDryRun" checked>Dry Run (Preview changes)</vscode-checkbox>
			</div>
			
			<div class="button-group">
				<vscode-button id="removePackageBtn">🗑️ Remove Package</vscode-button>
			</div>
		</form>
	</div>

	<!-- Sync Versions Section -->
	<div class="section">
		<h2>🔄 Sync Package Versions</h2>
		<form id="syncVersionsForm">
			<div class="form-group">
				<label for="syncPackageName">Package Name:</label>
				<vscode-text-field id="syncPackageName" placeholder="e.g., typescript, react"></vscode-text-field>
			</div>
			
			<div class="button-group">
				<vscode-button id="checkVersionsBtn">🔍 Check Versions</vscode-button>
			</div>
			
			<div id="versionsList" class="hidden">
				<div class="form-group">
					<label for="targetVersion">Target Version:</label>
					<vscode-dropdown id="targetVersion">
						<!-- Populated dynamically -->
					</vscode-dropdown>
				</div>
				
				<div class="form-group">
					<vscode-checkbox id="syncDryRun" checked>Dry Run (Preview changes)</vscode-checkbox>
				</div>
				
				<div class="button-group">
					<vscode-button id="syncVersionsBtn">🔄 Sync Versions</vscode-button>
				</div>
			</div>
		</form>
	</div>

	<!-- Version Conflicts Section -->
	<div class="section">
		<h2>⚠️ Version Conflicts</h2>
		<div class="button-group">
			<vscode-button id="findConflictsBtn">🔍 Find Conflicts</vscode-button>
			<vscode-button id="resolveAllBtn" class="hidden">🔧 Resolve All</vscode-button>
		</div>
		<div id="conflictsContainer">
			<!-- Populated dynamically -->
		</div>
	</div>

	<!-- Installation Section -->
	<div class="section">
		<h2>📦 Package Installation</h2>
		<p>Install packages after making changes</p>
		<div class="button-group">
			<vscode-button id="installPackagesBtn">📦 Install Packages</vscode-button>
		</div>
		<div id="installationStatus" class="hidden"></div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		
		let currentWorkspaces = [];
		let currentConflicts = [];
		let currentPackageManager = 'npm';

		// Initialize event listeners
		document.addEventListener('DOMContentLoaded', () => {
			initializeEventListeners();
		});

		function initializeEventListeners() {
			// Scan workspaces
			document.getElementById('scanWorkspaces').addEventListener('click', () => {
				vscode.postMessage({ command: 'scanWorkspaces' });
			});

			// Add package form
			document.getElementById('packageName').addEventListener('input', (e) => {
				if (e.target.value) {
					vscode.postMessage({ 
						command: 'fetchLatestVersion', 
						data: { packageName: e.target.value }
					});
				}
			});

			document.getElementById('addPackageBtn').addEventListener('click', (e) => {
				e.preventDefault();
				handleAddPackage();
			});

			// Remove package form
			document.getElementById('removePackageBtn').addEventListener('click', (e) => {
				e.preventDefault();
				handleRemovePackage();
			});

			// Sync versions form
			document.getElementById('checkVersionsBtn').addEventListener('click', (e) => {
				e.preventDefault();
				handleCheckVersions();
			});

			document.getElementById('syncVersionsBtn').addEventListener('click', (e) => {
				e.preventDefault();
				handleSyncVersions();
			});

			// Conflicts
			document.getElementById('findConflictsBtn').addEventListener('click', () => {
				vscode.postMessage({ command: 'resolveConflicts' });
			});

			// Installation
			document.getElementById('installPackagesBtn').addEventListener('click', () => {
				const workspacePaths = currentWorkspaces.map(w => w.path);
				vscode.postMessage({ 
					command: 'installPackages', 
					data: { targetWorkspaces: workspacePaths }
				});
			});
		}

		// Handle messages from extension
		window.addEventListener('message', event => {
			const { command, data } = event.data;

			switch (command) {
				case 'initialData':
					handleInitialData(data);
					break;
				case 'workspacesScanned':
					handleWorkspacesScanned(data);
					break;
				case 'packageAdded':
					handlePackageAdded(data);
					break;
				case 'packageRemoved':
					handlePackageRemoved(data);
					break;
				case 'versionsSynced':
					handleVersionsSynced(data);
					break;
				case 'conflictsFound':
					handleConflictsFound(data);
					break;
				case 'latestVersionFetched':
					handleLatestVersionFetched(data);
					break;
				case 'packageVersionsRetrieved':
					handlePackageVersionsRetrieved(data);
					break;
				case 'installationStarted':
					handleInstallationStarted();
					break;
				case 'installationCompleted':
					handleInstallationCompleted(data);
					break;
				case 'dataUpdated':
					handleDataUpdated(data);
					break;
				case 'error':
					showStatusMessage(data.message, 'error');
					break;
			}
		});

		function handleInitialData(data) {
			currentWorkspaces = data.workspaces;
			currentConflicts = data.conflicts;
			currentPackageManager = data.packageManager;
			
			renderWorkspaces(data.workspaces);
			renderWorkspaceSelections(data.workspaces);
			renderPackageOptions(data.workspaces);
		}

		function handleWorkspacesScanned(data) {
			currentWorkspaces = data.workspaces;
			renderWorkspaces(data.workspaces);
			renderWorkspaceSelections(data.workspaces);
			renderPackageOptions(data.workspaces);
		}

		function handlePackageAdded(data) {
			if (data.dryRun) {
				showChangesPreview('Package Add Preview', data.changes);
			} else {
				showStatusMessage('Package added successfully!', 'success');
			}
		}

		function handlePackageRemoved(data) {
			if (data.dryRun) {
				showChangesPreview('Package Removal Preview', data.changes);
			} else {
				showStatusMessage('Package removed successfully!', 'success');
			}
		}

		function handleVersionsSynced(data) {
			if (data.dryRun) {
				showChangesPreview('Version Sync Preview', data.result.changes);
			} else {
				showStatusMessage('Versions synced successfully!', 'success');
			}
		}

		function handleConflictsFound(data) {
			currentConflicts = data.conflicts;
			renderConflicts(data.conflicts);
		}

		function handleLatestVersionFetched(data) {
			const infoElement = document.getElementById('latestVersionInfo');
			if (data.latestVersion) {
				infoElement.textContent = \`Latest version: \${data.latestVersion}\`;
				infoElement.classList.remove('hidden');
			} else {
				infoElement.classList.add('hidden');
			}
		}

		function handlePackageVersionsRetrieved(data) {
			renderVersionOptions(data.versionInfo);
		}

		function handleInstallationStarted() {
			const statusEl = document.getElementById('installationStatus');
			statusEl.innerHTML = '<div class="loading"><div class="spinner"></div><span>Installing packages...</span></div>';
			statusEl.classList.remove('hidden');
		}

		function handleInstallationCompleted(data) {
			const statusEl = document.getElementById('installationStatus');
			if (data.result.success) {
				statusEl.innerHTML = '<div class="status-success">✅ Packages installed successfully!</div>';
			} else {
				statusEl.innerHTML = \`<div class="status-error">❌ Installation failed: \${data.result.error}</div>\`;
			}
		}

		function handleDataUpdated(data) {
			currentWorkspaces = data.workspaces;
			currentConflicts = data.conflicts;
			renderWorkspaces(data.workspaces);
			renderWorkspaceSelections(data.workspaces);
			renderPackageOptions(data.workspaces);
		}

		function renderWorkspaces(workspaces) {
			const container = document.getElementById('workspacesContainer');
			
			if (workspaces.length === 0) {
				container.innerHTML = '<p>No workspaces found. Click "Scan Workspaces" to search for package.json files.</p>';
				return;
			}

			const grouped = workspaces.reduce((acc, workspace) => {
				if (!acc[workspace.type]) acc[workspace.type] = [];
				acc[workspace.type].push(workspace);
				return acc;
			}, {});

			let html = '';
			Object.entries(grouped).forEach(([type, workspaces]) => {
				const icon = type === 'app' ? '📱' : type === 'package' ? '📦' : '🏠';
				html += \`<div class="workspace-card">
					<h3>\${icon} \${type.toUpperCase()}S (\${workspaces.length})</h3>\`;
				
				workspaces.forEach(workspace => {
					html += \`<p>• \${workspace.name} <small>(\${workspace.relativePath})</small></p>\`;
				});
				
				html += '</div>';
			});

			container.innerHTML = html;
		}

		function renderWorkspaceSelections(workspaces) {
			const containers = ['workspaceSelection', 'removeWorkspaceSelection'];
			
			containers.forEach(containerId => {
				const container = document.getElementById(containerId);
				let html = '';
				
				workspaces.forEach(workspace => {
					const icon = workspace.type === 'app' ? '📱' : workspace.type === 'package' ? '📦' : '🏠';
					html += \`<div class="checkbox-item">
						<input type="checkbox" id="\${containerId}_\${workspace.path}" value="\${workspace.path}">
						<label for="\${containerId}_\${workspace.path}">\${icon} \${workspace.name} <small>(\${workspace.relativePath})</small></label>
					</div>\`;
				});
				
				container.innerHTML = html;
			});
		}

		function renderPackageOptions(workspaces) {
			const allPackages = new Set();
			workspaces.forEach(workspace => {
				const deps = {
					...workspace.packageJson.dependencies,
					...workspace.packageJson.devDependencies,
					...workspace.packageJson.peerDependencies
				};
				Object.keys(deps).forEach(pkg => allPackages.add(pkg));
			});

			const dropdown = document.getElementById('packageToRemove');
			dropdown.innerHTML = '';
			
			Array.from(allPackages).sort().forEach(pkg => {
				const option = document.createElement('vscode-option');
				option.value = pkg;
				option.textContent = pkg;
				dropdown.appendChild(option);
			});
		}

		function renderVersionOptions(versionInfo) {
			const dropdown = document.getElementById('targetVersion');
			dropdown.innerHTML = '';
			
			Array.from(versionInfo.versions.entries()).forEach(([version, workspaces]) => {
				const option = document.createElement('vscode-option');
				option.value = version;
				option.textContent = \`\${version} (used in \${workspaces.length} workspace\${workspaces.length > 1 ? 's' : ''})\`;
				dropdown.appendChild(option);
			});

			document.getElementById('versionsList').classList.remove('hidden');
		}

		function renderConflicts(conflicts) {
			const container = document.getElementById('conflictsContainer');
			
			if (conflicts.length === 0) {
				container.innerHTML = '<div class="status-success">🎉 No version conflicts found!</div>';
				document.getElementById('resolveAllBtn').classList.add('hidden');
				return;
			}

			document.getElementById('resolveAllBtn').classList.remove('hidden');
			
			let html = '';
			conflicts.forEach(conflict => {
				html += \`<div class="conflict-item">
					<h3>⚠️ \${conflict.packageName}</h3>
					<div class="version-list">\`;
				
				Array.from(conflict.versions.entries()).forEach(([version, workspaces]) => {
					html += \`<div class="version-item">
						<strong>\${version}</strong> - Used in: \${workspaces.map(w => w.name).join(', ')}
					</div>\`;
				});
				
				html += '</div></div>';
			});
			
			container.innerHTML = html;
		}

		function handleAddPackage() {
			const packageName = document.getElementById('packageName').value;
			const version = document.getElementById('packageVersion').value;
			const dependencyType = document.getElementById('dependencyType').value;
			const dryRun = document.getElementById('dryRun').checked;
			
			const selectedWorkspaces = Array.from(document.querySelectorAll('#workspaceSelection input:checked'))
				.map(input => input.value);

			if (!packageName || !version || selectedWorkspaces.length === 0) {
				showStatusMessage('Please fill in all fields and select at least one workspace', 'error');
				return;
			}

			const config = {
				packageName,
				version,
				dependencyType,
				targetWorkspaces: selectedWorkspaces,
				dryRun
			};

			vscode.postMessage({ command: 'addPackage', data: { config } });
		}

		function handleRemovePackage() {
			const packageName = document.getElementById('packageToRemove').value;
			const dryRun = document.getElementById('removeDryRun').checked;
			
			const selectedWorkspaces = Array.from(document.querySelectorAll('#removeWorkspaceSelection input:checked'))
				.map(input => input.value);

			if (!packageName || selectedWorkspaces.length === 0) {
				showStatusMessage('Please select a package and at least one workspace', 'error');
				return;
			}

			vscode.postMessage({ 
				command: 'removePackage', 
				data: { packageName, targetWorkspaces: selectedWorkspaces, dryRun }
			});
		}

		function handleCheckVersions() {
			const packageName = document.getElementById('syncPackageName').value;
			
			if (!packageName) {
				showStatusMessage('Please enter a package name', 'error');
				return;
			}

			vscode.postMessage({ 
				command: 'getPackageVersions', 
				data: { packageName }
			});
		}

		function handleSyncVersions() {
			const packageName = document.getElementById('syncPackageName').value;
			const targetVersion = document.getElementById('targetVersion').value;
			const dryRun = document.getElementById('syncDryRun').checked;
			
			if (!packageName || !targetVersion) {
				showStatusMessage('Please select a target version', 'error');
				return;
			}

			vscode.postMessage({ 
				command: 'syncVersions', 
				data: { packageName, targetVersion, dryRun }
			});
		}

		function showStatusMessage(message, type = 'info') {
			const container = document.getElementById('statusContainer');
			const messageEl = document.createElement('div');
			messageEl.className = \`status-message status-\${type}\`;
			messageEl.textContent = message;
			
			container.appendChild(messageEl);
			
			// Auto-remove after 5 seconds
			setTimeout(() => {
				if (messageEl.parentNode) {
					messageEl.parentNode.removeChild(messageEl);
				}
			}, 5000);
		}

		function showChangesPreview(title, changes) {
			let message = \`\${title}:\\n\`;
			changes.forEach(change => {
				if (change.action) {
					message += \`• \${change.workspace}: \${change.action} \${change.after}\\n\`;
				} else if (change.before && change.after) {
					message += \`• \${change.workspace}: \${change.before} → \${change.after}\\n\`;
				} else {
					message += \`• \${change.workspace}: \${change.type} (\${change.version})\\n\`;
				}
			});
			showStatusMessage(message, 'warning');
		}
	</script>
</body>
</html>`;
}
