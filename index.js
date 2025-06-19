#!/usr/bin/env node

const fs = require("node:fs").promises;
const nodeFs = require("node:fs");
const path = require("node:path");
const AdmZip = require("adm-zip");
require("dotenv").config();

// GitHub repository information
const OWNER = "codynog";
const REPO = "ai-rules";
const VERSION_FILE = ".ai-rules-version.json";
const CURSOR_RULES_DIR = ".cursor/rules";
const ROO_RULES_DIR = ".roo/rules";
const CLINE_RULES_DIR = ".clinerules";
const CLAUDE_RULES_DIR = ".claude/rules";
const CLAUDE_LOCAL_DIR = ".claude/local";
const CLAUDE_PERSONAS_DIR = ".claude/personas";
const CLAUDE_COMMANDS_DIR = ".claude/commands";
const CLAUDE_PROJECT_MEMORY = "CLAUDE.md";

// Octokit and fetch will be imported dynamically
let octokit;
let fetch;

// Initialize required modules
async function initModules() {
	const { Octokit } = await import("@octokit/rest");
	octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN,
	});

	const fetchModule = await import("node-fetch");
	fetch = fetchModule.default;

	return true;
}

// Get the latest version from GitHub
async function getLatestVersion() {
	const { data: tags } = await octokit.repos.listTags({
		owner: OWNER,
		repo: REPO,
		per_page: 1,
	});

	if (tags.length === 0) {
		console.log("❌ No tags found in the repository");
		return null;
	}

	const latestVersion = tags[0].name.startsWith("v")
		? tags[0].name.substring(1)
		: tags[0].name;

	console.log(`✅ Latest version: ${latestVersion}`);
	return latestVersion;
}

// Check if version file exists and get current version
async function getCurrentVersion(outputPath) {
	const versionFilePath = path.join(outputPath, VERSION_FILE);

	if (nodeFs.existsSync(versionFilePath)) {
		const versionData = JSON.parse(await fs.readFile(versionFilePath, "utf8"));
		console.log(`✅ Current version: ${versionData.version}`);
		return versionData.version;
	}

	console.log("❌ Version file not found");
	return null;
}

// Download and extract the latest rules
async function downloadLatestRules(version, baseDir) {
	const tagName = `v${version}`;
	console.log(
		`🔄 Downloading rules version ${version} using tag '${tagName}' via Octokit...`,
	);

	const { data: zipDataBuffer } = await octokit.repos.downloadZipballArchive({
		owner: OWNER,
		repo: REPO,
		ref: tagName,
	});

	const zipData = Buffer.from(zipDataBuffer);

	const tempFilePath = path.join(baseDir, `temp-${version}.zip`);
	await fs.writeFile(tempFilePath, zipData);

	// Extract the zipball
	const zip = new AdmZip(tempFilePath);
	const tempExtractPath = path.join(baseDir, `temp-extract-${version}`);
	zip.extractAllTo(tempExtractPath, true);

	await fs.unlink(tempFilePath);

	console.log(`✅ Downloaded and extracted rules version ${version}`);
	return tempExtractPath;
}

// Update version file
async function updateVersionFile(outputPath, version) {
	const versionFilePath = path.join(outputPath, VERSION_FILE);
	const versionData = { version };

	await fs.writeFile(
		versionFilePath,
		JSON.stringify(versionData, null, 2),
		"utf8",
	);
	console.log(`✅ Updated version file to ${version}`);
	return true;
}

// --- Helper function to write merged rules content ONLY to copilot-instructions.md ---
async function writeCopilotInstructionsFile(outputPath, rulesContent) {
	const copilotInstructionsDir = path.join(outputPath, ".github");
	const targetFile = path.join(
		copilotInstructionsDir,
		"copilot-instructions.md",
	);

	await fs.mkdir(copilotInstructionsDir, { recursive: true });

	await fs.writeFile(targetFile, rulesContent, "utf8");

	console.log(
		`✅ Created/Updated ${path.relative(outputPath, targetFile)} in ${outputPath}`,
	);
}

// --- Helper function to process and write individual MDC rules (for Cursor) ---
async function processAndWriteMdcFiles(srcDir, destCursorDir) {
	if (!nodeFs.existsSync(srcDir)) {
		console.warn(`⚠️ Source directory for MDC processing not found: ${srcDir}`);
		return;
	}

	await fs.mkdir(destCursorDir, { recursive: true });
	const entries = await fs.readdir(srcDir, { withFileTypes: true });

	for (const entry of entries) {
		// Skip the 'modes' directory
		if (entry.isDirectory() && entry.name === "modes") {
			console.log(
				`ℹ️ Skipping 'modes' directory during Cursor rule processing in: ${srcDir}`,
			);
			continue;
		}

		const srcPath = path.join(srcDir, entry.name);
		// Output path for .mdc file in .cursor/rules/
		const destMdcPath = path.join(
			destCursorDir,
			entry.name.replace(/\.md$/, ".mdc"),
		);

		if (entry.isDirectory()) {
			// Recursively process subdirectories
			await processAndWriteMdcFiles(srcPath, destMdcPath);
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			const content = await fs.readFile(srcPath, "utf8");
			// Basic metadata generation (can be improved)
			const description = entry.name.replace(".md", "").replace(/-/g, " ");
			const metadata = `---
description: Rule for ${description}
alwaysApply: false
---

`;
			const mdcContent = metadata + content;
			// Always overwrite for the base processing
			await fs.writeFile(destMdcPath, mdcContent, "utf8");
			console.log(
				`✅ Processed and wrote Cursor rule (overwrite): ${path.relative(process.cwd(), destMdcPath)}`,
			);
		}
	}
}

// --- Helper function to APPEND MDC rules from local-ai-rules ---
async function processAndAppendMdcFiles(localRulesSrcDir, destCursorDir) {
	if (!nodeFs.existsSync(localRulesSrcDir)) {
		console.log(
			`ℹ️ No local-ai-rules directory found at ${localRulesSrcDir}. Skipping append for Cursor.`,
		);
		return;
	}
	const entries = await fs.readdir(localRulesSrcDir, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = path.join(localRulesSrcDir, entry.name);
		const destMdcPath = path.join(
			destCursorDir,
			entry.name.replace(/\.md$/, ".mdc"),
		);

		if (entry.isFile() && entry.name.endsWith(".md")) {
			const content = await fs.readFile(srcPath, "utf8");
			const description = entry.name.replace(".md", "").replace(/-/g, " ");
			const metadata = `---
description: Rule for ${description} (local)
alwaysApply: false
---

`;
			const mdcContentToAppend = metadata + content;

			if (nodeFs.existsSync(destMdcPath)) {
				const existingContent = await fs.readFile(destMdcPath, "utf8");
				const finalContent =
					existingContent +
					(existingContent.endsWith("\n") ? "" : "\n\n") +
					mdcContentToAppend;
				await fs.writeFile(destMdcPath, finalContent, "utf8");
				console.log(
					`✅ Appended local rule to Cursor MDC: ${path.relative(process.cwd(), destMdcPath)}`,
				);
			} else {
				// If target doesn't exist (e.g. local-only rule), create it
				await fs.writeFile(destMdcPath, mdcContentToAppend, "utf8");
				console.log(
					`✅ Wrote local rule to new Cursor MDC: ${path.relative(process.cwd(), destMdcPath)}`,
				);
			}
		}
	}
}

// --- Helper function to copy rule files to the Roo directory (Overwrite) ---
async function copyRulesToRooDir(srcDir, destRooDir) {
	if (!nodeFs.existsSync(srcDir)) {
		console.warn(`⚠️ Source directory for Roo processing not found: ${srcDir}`);
		return;
	}

	await fs.mkdir(destRooDir, { recursive: true });
	const entries = await fs.readdir(srcDir, { withFileTypes: true });

	for (const entry of entries) {
		// srcDir 直下の 'modes' ディレクトリはスキップ
		if (
			entry.isDirectory() &&
			entry.name === "modes" &&
			path.basename(srcDir) === "src" // Only skip 'modes' at the top level of srcPath
		) {
			console.log(
				`ℹ️ Skipping 'modes' directory during Roo rule copying in: ${srcDir}`,
			);
			continue;
		}

		const srcPath = path.join(srcDir, entry.name);
		const destPath = path.join(destRooDir, entry.name);

		if (entry.isDirectory()) {
			// Recursively copy subdirectories
			await copyRulesToRooDir(srcPath, destPath);
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			await fs.copyFile(srcPath, destPath); // Always overwrite
			console.log(
				`✅ Copied to Roo rules (overwrite): ${path.relative(process.cwd(), destPath)}`,
			);
		}
	}
}

// --- Helper function to APPEND rule files from local-ai-rules to the Roo directory ---
async function appendRulesToRooDir(localRulesSrcDir, destRooDir) {
	if (!nodeFs.existsSync(localRulesSrcDir)) {
		console.log(
			`ℹ️ No local-ai-rules directory found at ${localRulesSrcDir}. Skipping append for Roo.`,
		);
		return;
	}

	const entries = await fs.readdir(localRulesSrcDir, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(localRulesSrcDir, entry.name);
		const destPath = path.join(destRooDir, entry.name);

		if (entry.isFile() && entry.name.endsWith(".md")) {
			if (nodeFs.existsSync(destPath)) {
				const existingContent = await fs.readFile(destPath, "utf8");
				const newContent = await fs.readFile(srcPath, "utf8");
				const contentToAppend =
					(existingContent.endsWith("\n") ? "" : "\n\n") + newContent;
				await fs.writeFile(destPath, existingContent + contentToAppend, "utf8");
				console.log(
					`✅ Appended local rule to Roo: ${path.relative(process.cwd(), destPath)}`,
				);
			} else {
				await fs.copyFile(srcPath, destPath);
				console.log(
					`✅ Copied local rule to new Roo file: ${path.relative(process.cwd(), destPath)}`,
				);
			}
		}
	}
}

// --- Helper function to write rule content to the Cline directory (Overwrite) ---
async function writeRulesToClineDir(srcDir, destClineDir) {
	if (!nodeFs.existsSync(srcDir)) {
		console.warn(
			`⚠️ Source directory for Cline rules write not found: ${srcDir}`,
		);
		return;
	}

	await fs.mkdir(destClineDir, { recursive: true });
	const entries = await fs.readdir(srcDir, { withFileTypes: true });

	for (const entry of entries) {
		// Skip the 'modes' directory
		if (entry.isDirectory() && entry.name === "modes") {
			console.log(
				`ℹ️ Skipping 'modes' directory during Cline rule processing in: ${srcDir}`,
			);
			continue;
		}

		const srcPath = path.join(srcDir, entry.name);
		const destPath = path.join(destClineDir, entry.name);

		if (entry.isDirectory()) {
			await writeRulesToClineDir(srcPath, destPath);
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			const content = await fs.readFile(srcPath, "utf8");
			await fs.writeFile(destPath, content, "utf8"); // Always overwrite
			console.log(
				`✅ Wrote Cline rule (overwrite): ${path.relative(process.cwd(), destPath)}`,
			);
		}
	}
}

// --- Helper function to APPEND rule content from local-ai-rules to the Cline directory ---
async function appendRulesToClineDir(localRulesSrcDir, destClineDir) {
	if (!nodeFs.existsSync(localRulesSrcDir)) {
		console.log(
			`ℹ️ No local-ai-rules directory found at ${localRulesSrcDir}. Skipping append for Cline.`,
		);
		return;
	}
	const entries = await fs.readdir(localRulesSrcDir, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = path.join(localRulesSrcDir, entry.name);
		const destPath = path.join(destClineDir, entry.name);

		if (entry.isFile() && entry.name.endsWith(".md")) {
			if (nodeFs.existsSync(destPath)) {
				const existingContent = await fs.readFile(destPath, "utf8");
				const newContent = await fs.readFile(srcPath, "utf8");
				const contentToAppend =
					(existingContent.endsWith("\n") ? "" : "\n\n") + newContent;
				await fs.writeFile(destPath, existingContent + contentToAppend, "utf8");
				console.log(
					`✅ Appended local rule to Cline: ${path.relative(process.cwd(), destPath)}`,
				);
			} else {
				const content = await fs.readFile(srcPath, "utf8");
				await fs.writeFile(destPath, content, "utf8");
				console.log(
					`✅ Wrote local rule to new Cline file: ${path.relative(process.cwd(), destPath)}`,
				);
			}
		}
	}
}

// --- Helper function to copy rule files to the Claude rules directory (Overwrite) ---
async function copyRulesToClaudeRulesDir(srcDir, destClaudeRulesDir) {
	if (!nodeFs.existsSync(srcDir)) {
		console.warn(
			`⚠️ Source directory for Claude rules processing not found: ${srcDir}`,
		);
		return;
	}

	await fs.mkdir(destClaudeRulesDir, { recursive: true });
	const entries = await fs.readdir(srcDir, { withFileTypes: true });

	for (const entry of entries) {
		// Skip the 'modes', 'commands', and 'personas' directories
		if (entry.isDirectory() && (entry.name === "modes" || entry.name === "commands" || entry.name === "personas")) {
			console.log(
				`ℹ️ Skipping '${entry.name}' directory during Claude rule processing in: ${srcDir}`,
			);
			continue;
		}

		const srcPath = path.join(srcDir, entry.name);
		const destPath = path.join(destClaudeRulesDir, entry.name);

		if (entry.isDirectory()) {
			// Recursively copy subdirectories
			await copyRulesToClaudeRulesDir(srcPath, destPath);
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			await fs.copyFile(srcPath, destPath); // Always overwrite
			console.log(
				`✅ Copied to Claude rules (overwrite): ${path.relative(process.cwd(), destPath)}`,
			);
		}
	}
}

// --- Helper function to copy local rule files to the Claude local directory ---
async function copyLocalRulesToClaudeLocalDir(
	localRulesSrcDir,
	destClaudeLocalDir,
) {
	if (!nodeFs.existsSync(localRulesSrcDir)) {
		console.log(
			`ℹ️ No local-ai-rules directory found at ${localRulesSrcDir}. Skipping Claude local rules.`,
		);
		return;
	}

	await fs.mkdir(destClaudeLocalDir, { recursive: true });
	const entries = await fs.readdir(localRulesSrcDir, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(localRulesSrcDir, entry.name);
		const destPath = path.join(destClaudeLocalDir, entry.name);

		if (entry.isFile() && entry.name.endsWith(".md")) {
			await fs.copyFile(srcPath, destPath);
			console.log(
				`✅ Copied local rule to Claude local: ${path.relative(process.cwd(), destPath)}`,
			);
		}
	}
}

// --- Helper function to copy persona files to the Claude personas directory ---
async function copyPersonasToClaudePersonasDir(
	personasSrcDir,
	destClaudePersonasDir,
) {
	if (!nodeFs.existsSync(personasSrcDir)) {
		console.log(
			`ℹ️ No personas directory found at ${personasSrcDir}. Skipping Claude personas.`,
		);
		return;
	}

	await fs.mkdir(destClaudePersonasDir, { recursive: true });
	const entries = await fs.readdir(personasSrcDir, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(personasSrcDir, entry.name);
		const destPath = path.join(destClaudePersonasDir, entry.name);

		if (entry.isFile() && entry.name.endsWith(".md")) {
			await fs.copyFile(srcPath, destPath);
			console.log(
				`✅ Copied persona to Claude personas: ${path.relative(process.cwd(), destPath)}`,
			);
		}
	}
}

// --- Helper function to copy command files to the Claude commands directory ---
async function copyCommandsToClaudeCommandsDir(
	commandsSrcDir,
	destClaudeCommandsDir,
) {
	if (!nodeFs.existsSync(commandsSrcDir)) {
		console.log(
			`ℹ️ No commands directory found at ${commandsSrcDir}. Skipping Claude commands.`,
		);
		return;
	}

	await fs.mkdir(destClaudeCommandsDir, { recursive: true });
	const entries = await fs.readdir(commandsSrcDir, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(commandsSrcDir, entry.name);
		const destPath = path.join(destClaudeCommandsDir, entry.name);

		if (entry.isDirectory()) {
			// Recursively copy subdirectories
			await copyCommandsToClaudeCommandsDir(srcPath, destPath);
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			await fs.copyFile(srcPath, destPath);
			console.log(
				`✅ Copied command to Claude commands: ${path.relative(process.cwd(), destPath)}`,
			);
		}
	}
}

// --- Helper function to write Claude example memory files ---
async function writeClaudeExampleMemory(outputPath, srcPath, localRulesPath, personasPath) {
	// Generate CLAUDE.example.md (personal example)
	const claudeExamplePath = path.join(
		outputPath,
		".claude",
		"CLAUDE.example.md",
	);

	// Generate CLAUDE.base.md (team shared example)
	const claudeBasePath = path.join(
		outputPath,
		".claude",
		"CLAUDE.base.md",
	);

	// Generate CLAUDE.personal.md (personal configuration example)
	const claudePersonalPath = path.join(
		outputPath,
		".claude",
		"CLAUDE.personal.md",
	);

	// Generate example content (what was in base)
	const exampleContentLines = [];

	// Add header and instructions for example
	exampleContentLines.push("# Claude Code Memory");
	exampleContentLines.push("");
	exampleContentLines.push(
		"Copy this file to your project root as `CLAUDE.md` and customize as needed.",
	);
	exampleContentLines.push("");
	exampleContentLines.push("# Personal Configuration");
	exampleContentLines.push("@CLAUDE.personal.md");
	exampleContentLines.push("");

	// Add base rule import
	exampleContentLines.push("# AI Rules for this project");
	exampleContentLines.push("");
	exampleContentLines.push("See @.claude/rules/index.md for base rules.");
	exampleContentLines.push("");

	// Generate personal example content (simple with base import)
	const personalContentLines = [];

	// Add header and instructions for personal example
	personalContentLines.push("# Claude Code Memory Example (Personal)");
	personalContentLines.push("");
	personalContentLines.push(
		"Copy this file to your project root as `CLAUDE.md` and customize as needed.",
	);
	personalContentLines.push("Add your personal settings and import the team base configuration.");
	personalContentLines.push("");
	personalContentLines.push("# Personal Settings");
	personalContentLines.push("# Add your persona and personal preferences here");
	personalContentLines.push("");
	personalContentLines.push("# Team Base Configuration");
	personalContentLines.push("@CLAUDE.base.md");
	personalContentLines.push("");

	// Add technology-specific rule imports to example
	if (nodeFs.existsSync(srcPath)) {
		const srcEntries = await fs.readdir(srcPath, { withFileTypes: true });
		const techRules = srcEntries
			.filter(
				(entry) =>
					entry.isFile() &&
					entry.name.endsWith(".md") &&
					entry.name !== "index.md",
			)
			.map((entry) => entry.name);

		if (techRules.length > 0) {
			exampleContentLines.push("# Technology-specific rules");
			for (const techRule of techRules) {
				exampleContentLines.push(`@.claude/rules/${techRule}`);
			}
			exampleContentLines.push("");
		}
	}

	// Add local rule imports to example
	if (nodeFs.existsSync(localRulesPath)) {
		const localEntries = await fs.readdir(localRulesPath, {
			withFileTypes: true,
		});
		const localRules = localEntries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
			.map((entry) => entry.name);

		if (localRules.length > 0) {
			exampleContentLines.push("# Local project rules");
			for (const localRule of localRules) {
				exampleContentLines.push(`@.claude/local/${localRule}`);
			}
			exampleContentLines.push("");
		}
	}

	// Generate CLAUDE.personal.md content (separate personal config example)
	const personalConfigContentLines = [];
	personalConfigContentLines.push("# Claude Code Memory Personal Configuration");
	personalConfigContentLines.push("");
	personalConfigContentLines.push("");
	personalConfigContentLines.push("# Personal Preferences");
	personalConfigContentLines.push("# Add your personal coding preferences and settings here");
	personalConfigContentLines.push("");

	// Add persona imports to personal config example
	if (nodeFs.existsSync(personasPath)) {
		const personaEntries = await fs.readdir(personasPath, {
			withFileTypes: true,
		});
		const personas = personaEntries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
			.map((entry) => entry.name);

		if (personas.length > 0) {
			personalConfigContentLines.push("# Persona settings");
			for (const persona of personas) {
				personalConfigContentLines.push(`@.claude/personas/${persona}`);
			}
		}
	}

	// Update personal example content to import CLAUDE.personal.md
	personalContentLines.push("# Persona settings");
	personalContentLines.push("@CLAUDE.personal.md");
	personalContentLines.push("");

	// Write example and personal files (no more base file)
	const exampleFinalContent = exampleContentLines.join("\n");
	const personalConfigFinalContent = personalConfigContentLines.join("\n");
	
	await fs.writeFile(claudeExamplePath, exampleFinalContent, "utf8");
	await fs.writeFile(claudePersonalPath, personalConfigFinalContent, "utf8");

	console.log(
		`✅ Created Claude example: ${path.relative(process.cwd(), claudeExamplePath)}`,
	);
	console.log(
		`✅ Created Claude personal config example: ${path.relative(process.cwd(), claudePersonalPath)}`,
	);
}

// Main function
async function main() {
	// Initialize required modules first
	const modulesInitialized = await initModules();
	if (!modulesInitialized) {
		console.error("❌ Failed to initialize required modules");
		process.exit(1);
	}

	// Get output path from command line arguments
	const outputArgIndex = process.argv.findIndex(
		(arg) => arg === "--output" || arg === "-o",
	);
	const outputPath =
		outputArgIndex !== -1 ? process.argv[outputArgIndex + 1] : process.cwd();

	// Get mode from command line arguments
	const modeArgIndex = process.argv.findIndex(
		(arg) => arg === "--mode" || arg === "-m",
	);
	const mode = modeArgIndex !== -1 ? process.argv[modeArgIndex + 1] : "default";
	const isLocalMode = mode === "local";

	console.log(
		`🚀 Starting file processing in ${isLocalMode ? "local" : "default"} mode`,
	);
	console.log(`📂 Output destination: ${outputPath}`);

	await fs.mkdir(outputPath, { recursive: true });

	// Determine base directory based on mode
	const baseDir = isLocalMode ? process.cwd() : __dirname;

	// Check versions and update if necessary
	const currentVersion = await getCurrentVersion(outputPath);
	const latestVersion = await getLatestVersion();

	let srcPath = path.join(baseDir, "src");
	let extractPath = null; // Declare extractPath higher up
	let repoDir = null; // Declare repoDir higher up

	// If we're not in local mode, handle version management
	if (!isLocalMode) {
		if (latestVersion) {
			// If versions don't match and we have a latest version, download and use the latest rules
			if (currentVersion !== latestVersion) {
				console.log(
					`🔄 Version mismatch: current=${currentVersion || "none"}, latest=${latestVersion}`,
				);

				extractPath = await downloadLatestRules(latestVersion, baseDir);
				if (extractPath) {
					// Find the src directory in the extracted files
					const extractedDirs = await fs.readdir(extractPath, {
						withFileTypes: true,
					});
					repoDir = extractedDirs.find((dir) => dir.isDirectory());

					if (repoDir) {
						srcPath = path.join(extractPath, repoDir.name, "src");
						console.log(
							`✅ Using rules from downloaded version: ${latestVersion}`,
						);
					} else {
						console.error(
							"❌ Could not find repository directory in extracted files",
						);
					}
				}
			} else {
				console.log(`✅ Already using the latest version: ${currentVersion}`);
			}

			// Always update the version file in default mode to ensure it exists
			await updateVersionFile(outputPath, latestVersion);
		} else {
			console.log("⚠️ Could not determine latest version, using local files");
		}
	} else {
		console.log("ℹ️ Using local mode, skipping version check");
	}

	// --- Generate Cursor rules (.cursor/rules/*.mdc) ---
	const cursorRulesDestPath = path.join(outputPath, CURSOR_RULES_DIR);
	await processAndWriteMdcFiles(srcPath, cursorRulesDestPath); // Overwrite with base rules
	const localRulesSrcPathForCursor = path.join(outputPath, "local-ai-rules");
	await processAndAppendMdcFiles(
		localRulesSrcPathForCursor,
		cursorRulesDestPath,
	); // Append local rules

	// --- Generate Roo rules (.roo/rules/*.md) ---
	const rooRulesDestPath = path.join(outputPath, ROO_RULES_DIR);
	await copyRulesToRooDir(srcPath, rooRulesDestPath); // Overwrite with base rules
	const localRulesSrcPathForRoo = path.join(outputPath, "local-ai-rules");
	await appendRulesToRooDir(localRulesSrcPathForRoo, rooRulesDestPath); // Append local rules

	// --- Generate Cline rules (.clinerules/*.md) ---
	const clineRulesDestPath = path.join(outputPath, CLINE_RULES_DIR);
	await writeRulesToClineDir(srcPath, clineRulesDestPath); // Overwrite with base rules
	const localRulesSrcPathForCline = path.join(outputPath, "local-ai-rules");
	await appendRulesToClineDir(localRulesSrcPathForCline, clineRulesDestPath); // Append local rules

	// --- Generate Claude Code memory files (.claude/rules/*.md and example) ---
	const claudeRulesDestPath = path.join(outputPath, CLAUDE_RULES_DIR);
	const claudeLocalDestPath = path.join(outputPath, CLAUDE_LOCAL_DIR);
	const claudePersonasDestPath = path.join(outputPath, CLAUDE_PERSONAS_DIR);
	const claudeCommandsDestPath = path.join(outputPath, CLAUDE_COMMANDS_DIR);
	const localRulesSrcPathForClaude = path.join(outputPath, "local-ai-rules");
	const personasSrcPath = path.join(srcPath, "personas");
	const commandsSrcPath = path.join(srcPath, "commands");

	await copyRulesToClaudeRulesDir(srcPath, claudeRulesDestPath); // Copy base rules
	await copyLocalRulesToClaudeLocalDir(
		localRulesSrcPathForClaude,
		claudeLocalDestPath,
	); // Copy local rules
	await copyPersonasToClaudePersonasDir(
		personasSrcPath,
		claudePersonasDestPath,
	); // Copy personas
	await copyCommandsToClaudeCommandsDir(
		commandsSrcPath,
		claudeCommandsDestPath,
	); // Copy commands
	await writeClaudeExampleMemory(
		outputPath,
		srcPath,
		localRulesSrcPathForClaude,
		personasSrcPath,
	); // Generate CLAUDE.example.md

	// --- Load content from ORIGINAL source .md files for copilot-instructions.md ---
	// Read directly from the source paths (.md only).

	const allRuleContentsForMerging = []; // Store contents for copilot-instructions.md

	// Helper to read original .md file content
	async function readOriginalRuleContent(filePath) {
		// Ensure we are reading the .md file, not potentially generated .mdc
		const mdFilePath = filePath.endsWith(".md") ? filePath : `${filePath}.md`;
		if (nodeFs.existsSync(mdFilePath)) {
			content = await fs.readFile(mdFilePath, "utf8");
			console.log(
				`✅ Loaded for merging: ${path.relative(process.cwd(), mdFilePath)}`,
			);
			return content;
		}
		console.warn(`⚠️ Original rule file not found for merging: ${mdFilePath}`);
		return null;
	}

	// Load base rule (src/index.md)
	const baseRuleContent = await readOriginalRuleContent(
		path.join(srcPath, "index.md"),
	);
	if (baseRuleContent !== null) {
		allRuleContentsForMerging.push(baseRuleContent);
	}

	// Load local-ai-rules (local-ai-rules/*.md from output path)
	const localRulesReadPath = path.join(outputPath, "local-ai-rules");
	if (nodeFs.existsSync(localRulesReadPath)) {
		const localFileNames = (await fs.readdir(localRulesReadPath))
			.filter((file) => file.endsWith(".md"))
			.map((file) => file.replace(/\.md$/, ""));

		for (const localName of localFileNames) {
			// Read the original .md file from the local rules source directory
			const content = await readOriginalRuleContent(
				path.join(localRulesReadPath, `${localName}.md`),
			);
			if (content !== null) {
				allRuleContentsForMerging.push(content);
			}
		}
		console.log(`✅ Loaded local rules from ${localRulesReadPath} for merging`);
	} else {
		console.log(
			`ℹ️ No local-ai-rules directory found at ${localRulesReadPath}. Skipping local rules for merging.`,
		);
	}

	// --- Merge rules for copilot-instructions.md ---
	const finalMergedRules = allRuleContentsForMerging
		.filter((content) => content?.trim()) // Ensure content is not empty/whitespace
		.join("\n\n"); // Join non-empty parts with double newline

	// --- Write the merged rules ONLY to copilot-instructions.md ---
	await writeCopilotInstructionsFile(outputPath, finalMergedRules);

	// --- Generate Roo modes (.roomodes and .roo/rules/<mode-slug>/*) ---
	await generateRooModes(srcPath, outputPath);

	console.log("\n✨ All processing completed!");
}

// --- Helper function to copy files recursively (from generate-modes.js) ---
// const ROO_RULES_DIR_BASE = ".roo/rules"; // この定数は使わないようにする

/**
 * Copies a file from source to destination, creating directories if needed.
 * @param {string} srcPath - The source file path.
 * @param {string} destPath - The destination file path.
 */
async function copyFiles(srcPath, destPath) {
	await fs.mkdir(path.dirname(destPath), { recursive: true });
	await fs.copyFile(srcPath, destPath);
	console.log(
		`✅ Copied instruction file: ${path.basename(srcPath)} to ${path.relative(process.cwd(), destPath)}`,
	);
}

// --- Function to generate Roo modes (adapted from generate-modes.js) ---
/**
 * Generates Roo mode configuration files (.roomodes and instruction files).
 * Reads mode definitions from index.json files within mode directories.
 * @param {string} srcPath - The base source directory (e.g., 'src' or extracted path).
 * @param {string} outputPath - The target output directory.
 * @returns {Promise<void>}
 */
async function generateRooModes(srcPath, outputPath) {
	const modesSrcDir = path.join(srcPath, "modes"); // Use the determined srcPath
	console.log("\n🚀 Generating Roo modes...");
	console.log(`📂 Source directory for modes: ${modesSrcDir}`);
	console.log(`🎯 Output destination: ${outputPath}`);

	const allModeDefinitions = [];
	const instructionFilesToCopy = [];

	// Check if modes source directory exists before proceeding
	try {
		await fs.stat(modesSrcDir);
	} catch (error) {
		if (error.code === "ENOENT") {
			console.warn(
				`⚠️ Modes source directory not found: ${modesSrcDir}. Skipping Roo mode generation.`,
			);
			return; // Exit the function if the directory doesn't exist
		}
		// Re-throw other errors
		throw error;
	}

	// Read all entries in the modes source directory
	const modeDirs = await fs.readdir(modesSrcDir, { withFileTypes: true });

	for (const modeDirEntry of modeDirs) {
		if (modeDirEntry.isDirectory()) {
			const modeSlug = modeDirEntry.name;

			const modeDirPath = path.join(modesSrcDir, modeSlug); // Path within determined srcPath
			const indexJsonPath = path.join(modeDirPath, "index.json");
			const targetRooRulesDir = path.join(
				outputPath,
				".roo", // ベースは .roo
				`rules-${modeSlug}`, // ディレクトリ名を rules-<modeSlug> に
			);

			console.log(`\nProcessing mode: ${modeSlug}`);
			console.log(
				`  - Target Roo rules directory: ${path.relative(outputPath, targetRooRulesDir)}`,
			); // パスをログに出力

			// 1. Read index.json for mode definition
			try {
				// Check if index.json exists using async stat
				await fs.stat(indexJsonPath);
				// If stat succeeds, read the file
				const indexJsonContent = await fs.readFile(indexJsonPath, "utf8");
				/** @type {RooModeDefinition} */ // Add JSDoc type annotation
				const modeDefinition = JSON.parse(indexJsonContent);
				if (modeDefinition.slug !== modeSlug) {
					console.warn(
						`⚠️ Warning: Slug in ${indexJsonPath} ("${modeDefinition.slug}") does not match directory name ("${modeSlug}"). Using directory name.`,
					);
					modeDefinition.slug = modeSlug;
				}
				allModeDefinitions.push(modeDefinition);
				console.log("  - Found mode definition in index.json");
			} catch (error) {
				// Handle file not found or JSON parse errors gracefully
				if (error.code === "ENOENT") {
					console.warn(
						`  - index.json not found for mode ${modeSlug}. Skipping definition.`,
					);
				} else {
					console.error(`❌ Error processing ${indexJsonPath}:`, error);
				}
				// Continue processing instructions even if index.json is missing/invalid
				// continue; // ここをコメントアウト or 削除
			}

			// 2. Find instruction files (non-index.json files)
			const modeDirContents = await fs.readdir(modeDirPath, {
				withFileTypes: true,
			});
			let foundInstructions = false;
			for (const item of modeDirContents) {
				if (item.isFile() && item.name !== "index.json") {
					const srcFilePath = path.join(modeDirPath, item.name);
					const destFilePath = path.join(targetRooRulesDir, item.name); // targetRooRulesDir を使う
					instructionFilesToCopy.push({ src: srcFilePath, dest: destFilePath });
					foundInstructions = true;
				}
			}
			if (foundInstructions) {
				console.log("  - Found instruction files to copy.");
			} else {
				console.log("  - No instruction files found.");
			}
		}
	}

	// 3. Prepare final .roomodes content
	const finalRoomodesContent = {
		customModes: allModeDefinitions,
	};
	const roomodesOutputPath = path.join(outputPath, ".roomodes");

	// 4. Write .roomodes file (only if modes were found)
	if (allModeDefinitions.length > 0 || instructionFilesToCopy.length > 0) {
		await fs.writeFile(
			roomodesOutputPath,
			JSON.stringify(finalRoomodesContent, null, 2),
			"utf8",
		);
		console.log(
			`\n✅ Successfully wrote ${path.relative(process.cwd(), roomodesOutputPath)}`,
		);
	} else {
		console.log(
			"\nℹ️ No modes found or processed, skipping .roomodes file generation.",
		);
	}

	// 5. Copy all instruction files
	if (instructionFilesToCopy.length > 0) {
		console.log("\n🔄 Copying instruction files...");
		// Ensure the base .roo directory exists (copyFiles ensures specific rule dir)
		// await fs.mkdir(path.join(outputPath, ".roo"), { recursive: true }); // copyFiles内で作成されるので不要かも

		for (const fileInfo of instructionFilesToCopy) {
			await copyFiles(fileInfo.src, fileInfo.dest);
		}
		console.log(
			`✅ Successfully copied ${instructionFilesToCopy.length} instruction file(s).`,
		);
	} else {
		console.log("\nℹ️ No instruction files to copy.");
	}

	console.log("\n✨ Mode generation completed successfully!");
}

// Execute script
main().catch((error) => {
	console.error("❌ Top-level script execution failed:", error.message);
	if (error.stack) {
		console.error(error.stack);
	}
	process.exit(1);
});
