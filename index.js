#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
require('dotenv').config();

// GitHub repository information
const OWNER = 'codynog';
const REPO = 'ai-rules';
const VERSION_FILE = '.ai-rules-version.json'; // Removed dot prefix
const CURSOR_RULES_DIR = '.cursor/rules'; // Constant for Cursor rules
const ROO_RULES_DIR = '.roo/rules'; // Constant for Roo rules
const CLINE_RULES_DIR = '.clinerules'; // Constant for Cline rules directory

// Octokit and fetch will be imported dynamically
let octokit;
let fetch;

// Initialize required modules
async function initModules() {
  try {
    // Dynamically import @octokit/rest
    const { Octokit } = await import('@octokit/rest');
    octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    // Dynamically import node-fetch
    const fetchModule = await import('node-fetch');
    fetch = fetchModule.default;

    return true;
  } catch (error) {
    console.error(`❌ Failed to initialize modules: ${error.message}`);
    return false;
  }
}

// Get the latest version from GitHub
async function getLatestVersion() {
  try {
    const { data: tags } = await octokit.repos.listTags({
      owner: OWNER,
      repo: REPO,
      per_page: 1
    });

    if (tags.length === 0) {
      console.log('❌ No tags found in the repository');
      return null;
    }

    // Tag format is v2025.3.1, so remove the 'v' prefix
    const latestVersion = tags[0].name.startsWith('v')
      ? tags[0].name.substring(1)
      : tags[0].name;

    console.log(`✅ Latest version: ${latestVersion}`);
    return latestVersion;
  } catch (error) {
    console.error(`❌ Failed to get latest version: ${error.message}`);
    return null;
  }
}

// Check if version file exists and get current version
async function getCurrentVersion(outputPath) {
  const versionFilePath = path.join(outputPath, VERSION_FILE);

  try {
    if (fs.existsSync(versionFilePath)) {
      const versionData = JSON.parse(await fs.promises.readFile(versionFilePath, 'utf8'));
      console.log(`✅ Current version: ${versionData.version}`);
      return versionData.version;
    }
  } catch (error) {
    console.error(`❌ Failed to read version file: ${error.message}`);
  }

  console.log('❌ Version file not found or invalid');
  return null;
}

// Download and extract the latest rules
async function downloadLatestRules(version, baseDir) {
  try {
    // Assume tag name includes 'v' prefix based on release workflow
    const tagName = `v${version}`;
    console.log(`🔄 Downloading rules version ${version} using tag '${tagName}' via Octokit...`);

    // Use Octokit to get the zipball archive for the tag
    const { data: zipDataBuffer } = await octokit.repos.downloadZipballArchive({
      owner: OWNER,
      repo: REPO,
      ref: tagName,
    });

    // Convert ArrayBuffer to Buffer (Octokit returns ArrayBuffer)
    const zipData = Buffer.from(zipDataBuffer);

    // Save the zipball to a temporary file
    const tempFilePath = path.join(baseDir, `temp-${version}.zip`);
    await fs.promises.writeFile(tempFilePath, zipData);

    // Extract the zipball
    const zip = new AdmZip(tempFilePath);
    const tempExtractPath = path.join(baseDir, `temp-extract-${version}`);
    zip.extractAllTo(tempExtractPath, true);

    // Clean up the temporary zipball
    await fs.promises.unlink(tempFilePath);

    console.log(`✅ Downloaded and extracted rules version ${version}`);
    return tempExtractPath;
  } catch (error) {
    console.error(`❌ Failed to download latest rules: ${error.message}`);
    return null;
  }
}

// Update version file
async function updateVersionFile(outputPath, version) {
  const versionFilePath = path.join(outputPath, VERSION_FILE);
  const versionData = { version };

  try {
    await fs.promises.writeFile(versionFilePath, JSON.stringify(versionData, null, 2), 'utf8');
    console.log(`✅ Updated version file to ${version}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update version file: ${error.message}`);
    return false;
  }
}


// --- Helper function to write merged rules content ONLY to copilot-instructions.md ---
async function writeCopilotInstructionsFile(outputPath, rulesContent) {
    const copilotInstructionsDir = path.join(outputPath, '.github');
    const targetFile = path.join(copilotInstructionsDir, 'copilot-instructions.md');

    try {
        // Ensure the .github directory exists
        await fs.promises.mkdir(copilotInstructionsDir, { recursive: true });

        // Write content to the target file
        await fs.promises.writeFile(targetFile, rulesContent, 'utf8');

        console.log(`✅ Created/Updated ${path.relative(outputPath, targetFile)} in ${outputPath}`);
    } catch (error) {
        console.error(`❌ Failed to write copilot-instructions.md: ${error.message}`);
    }
}


// --- Helper function to process and write individual MDC rules (for Cursor) ---
async function processAndWriteMdcFiles(srcDir, destCursorDir) {
    try {
        if (!fs.existsSync(srcDir)) {
            console.warn(`⚠️ Source directory for MDC processing not found: ${srcDir}`);
            return;
        }

        await fs.promises.mkdir(destCursorDir, { recursive: true });
        const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(srcDir, entry.name);
            // Output path for .mdc file in .cursor/rules/
            const destMdcPath = path.join(destCursorDir, entry.name.replace(/\.md$/, '.mdc'));

            if (entry.isDirectory()) {
                // Recursively process subdirectories (like ai-docs)
                await processAndWriteMdcFiles(srcPath, destMdcPath); // Pass the corresponding dest dir
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                try {
                    const content = await fs.promises.readFile(srcPath, 'utf8');
                    // Basic metadata generation (can be improved)
                    const description = entry.name.replace('.md', '').replace(/-/g, ' ');
                    const metadata = `---
description: Rule for ${description}
alwaysApply: false
---

`;
                    const mdcContent = metadata + content;
                    await fs.promises.writeFile(destMdcPath, mdcContent, 'utf8');
                    console.log(`✅ Processed and wrote Cursor rule: ${path.relative(process.cwd(), destMdcPath)}`);
                } catch (fileError) {
                    console.warn(`⚠️ Failed to process or write MDC file ${entry.name}: ${fileError.message}`);
                }
            }
        }
    } catch (error) {
        console.error(`❌ Error processing directory ${srcDir} for Cursor rules: ${error.message}`);
    }
}


// --- Helper function to copy rule files to the Roo directory ---
async function copyRulesToRooDir(srcDir, destRooDir) {
    try {
        if (!fs.existsSync(srcDir)) {
            console.warn(`⚠️ Source directory for MDC processing not found: ${srcDir}`);
            return;
        }

        await fs.promises.mkdir(destRooDir, { recursive: true });
        const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(srcDir, entry.name);
            const destPath = path.join(destRooDir, entry.name); // Keep original name

            if (entry.isDirectory()) {
                // Recursively copy subdirectories (like ai-docs)
                await copyRulesToRooDir(srcPath, destPath);
            } else if (entry.isFile() && entry.name.endsWith('.md')) { // Copy only .md files
                try {
                    await fs.promises.copyFile(srcPath, destPath);
                    console.log(`✅ Copied to Roo rules: ${path.relative(process.cwd(), destPath)}`);
                } catch (fileError) {
                    console.warn(`⚠️ Failed to copy rule file ${entry.name} to Roo dir: ${fileError.message}`);
                }
            }
        }
    } catch (error) {
        console.error(`❌ Error copying rules to ${destRooDir}: ${error.message}`);
    }
}


// --- Helper function to write rule content to the Cline directory ---
async function writeRulesToClineDir(srcDir, destClineDir) {
    try {
        if (!fs.existsSync(srcDir)) {
            console.warn(`⚠️ Source directory for Cline rules write not found: ${srcDir}`);
            return;
        }

        await fs.promises.mkdir(destClineDir, { recursive: true });
        const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(srcDir, entry.name);
            const destPath = path.join(destClineDir, entry.name); // Keep original name (.md)

            if (entry.isDirectory()) {
                // Recursively write content from subdirectories (like ai-docs)
                await writeRulesToClineDir(srcPath, destPath);
            } else if (entry.isFile() && entry.name.endsWith('.md')) { // Process only .md files
                try {
                    const content = await fs.promises.readFile(srcPath, 'utf8');
                    // Write the plain content (no metadata added or removed here)
                    await fs.promises.writeFile(destPath, content, 'utf8');
                    console.log(`✅ Wrote Cline rule: ${path.relative(process.cwd(), destPath)}`);
                } catch (fileError) {
                    console.warn(`⚠️ Failed to write rule file ${entry.name} to Cline dir: ${fileError.message}`);
                }
            }
        }
    } catch (error) {
        console.error(`❌ Error writing rules to ${destClineDir}: ${error.message}`);
    }
}


// Main function
async function main() {
  try {
    // Initialize required modules first
    const modulesInitialized = await initModules();
    if (!modulesInitialized) {
      console.error('❌ Failed to initialize required modules');
      process.exit(1);
    }

    // Get output path from command line arguments
    const outputArgIndex = process.argv.findIndex(arg => arg === '--output' || arg === '-o');
    const outputPath = outputArgIndex !== -1 ? process.argv[outputArgIndex + 1] : process.cwd();

    // Get mode from command line arguments
    const modeArgIndex = process.argv.findIndex(arg => arg === '--mode' || arg === '-m');
    const mode = modeArgIndex !== -1 ? process.argv[modeArgIndex + 1] : 'default';
    const isLocalMode = mode === 'local';

    console.log(`🚀 Starting file processing in ${isLocalMode ? 'local' : 'default'} mode`);
    console.log(`📂 Output destination: ${outputPath}`);

    // Create output directory
    await fs.promises.mkdir(outputPath, { recursive: true });

    // Determine base directory based on mode
    const baseDir = isLocalMode ? process.cwd() : __dirname;

    // Check versions and update if necessary
    const currentVersion = await getCurrentVersion(outputPath);
    const latestVersion = await getLatestVersion();

    let srcPath = path.join(baseDir, 'src');
    let extractPath = null; // Declare extractPath higher up
    let repoDir = null; // Declare repoDir higher up

    // If we're not in local mode, handle version management
    if (!isLocalMode) {
      if (latestVersion) {
        // If versions don't match and we have a latest version, download and use the latest rules
        if (currentVersion !== latestVersion) {
          console.log(`🔄 Version mismatch: current=${currentVersion || 'none'}, latest=${latestVersion}`);

          extractPath = await downloadLatestRules(latestVersion, baseDir); // Assign to higher-scoped variable
          if (extractPath) {
            // Find the src directory in the extracted files
            const extractedDirs = await fs.promises.readdir(extractPath, { withFileTypes: true });
            repoDir = extractedDirs.find(dir => dir.isDirectory()); // Assign to higher-scoped variable

            if (repoDir) {
              srcPath = path.join(extractPath, repoDir.name, 'src');
              console.log(`✅ Using rules from downloaded version: ${latestVersion}`);
            } else {
              console.error('❌ Could not find repository directory in extracted files');
            }
          }
        } else {
          console.log(`✅ Already using the latest version: ${currentVersion}`);
        }

        // Always update the version file in default mode to ensure it exists
        await updateVersionFile(outputPath, latestVersion);
      } else {
        console.log('⚠️ Could not determine latest version, using local files');
      }
    } else {
      console.log('ℹ️ Using local mode, skipping version check');
    }

    // --- Generate Cursor rules (.cursor/rules/*.mdc) ---
    const cursorRulesDestPath = path.join(outputPath, CURSOR_RULES_DIR);
    await processAndWriteMdcFiles(srcPath, cursorRulesDestPath); // Process main src (index.md etc.)
    const localRulesSrcPathForCursor = path.join(outputPath, 'local-ai-rules'); // Source for local rules
    await processAndWriteMdcFiles(localRulesSrcPathForCursor, cursorRulesDestPath); // Process local rules

    // --- Generate Roo rules (.roo/rules/*.md) ---
    const rooRulesDestPath = path.join(outputPath, ROO_RULES_DIR);
    await copyRulesToRooDir(srcPath, rooRulesDestPath); // Copy main src (index.md etc.)
    const localRulesSrcPathForRoo = path.join(outputPath, 'local-ai-rules'); // Source for local rules
    await copyRulesToRooDir(localRulesSrcPathForRoo, rooRulesDestPath); // Copy local rules

    // --- Generate Cline rules (.clinerules/*.md) ---
    const clineRulesDestPath = path.join(outputPath, CLINE_RULES_DIR);
    await writeRulesToClineDir(srcPath, clineRulesDestPath); // Write main src content
    const localRulesSrcPathForCline = path.join(outputPath, 'local-ai-rules'); // Source for local rules
    await writeRulesToClineDir(localRulesSrcPathForCline, clineRulesDestPath); // Write local rules content


    // --- Load content from ORIGINAL source .md files for copilot-instructions.md ---
    // Read directly from the source paths (.md only).

    let allRuleContentsForMerging = []; // Store contents for copilot-instructions.md

    // Helper to read original .md file content
    async function readOriginalRuleContent(filePath) {
        let content = '';
        try {
            // Ensure we are reading the .md file, not potentially generated .mdc
            const mdFilePath = filePath.endsWith('.md') ? filePath : `${filePath}.md`;
            if (fs.existsSync(mdFilePath)) {
                content = await fs.promises.readFile(mdFilePath, 'utf8');
                console.log(`✅ Loaded for merging: ${path.relative(process.cwd(), mdFilePath)}`);
                return content;
            } else {
                 console.warn(`⚠️ Original rule file not found for merging: ${mdFilePath}`);
                 return null; // Indicate file not found
            }
        } catch (error) {
            console.warn(`⚠️ Failed to load original rule content from ${filePath}: ${error.message}`);
            return null; // Indicate error
        }
    }

    // Load base rule (src/index.md)
    const baseRuleContent = await readOriginalRuleContent(path.join(srcPath, 'index.md'));
    if (baseRuleContent !== null) {
        allRuleContentsForMerging.push(baseRuleContent);
    }


    // Load ai-docs rules (src/ai-docs/*.md)
    const aiDocsPath = path.join(srcPath, 'ai-docs');
    const configFilePath = path.join(outputPath, '.ai-rules-config.json');
    let docsToLoadNames = []; // Store just the base names (e.g., 'react')

    try {
        // Determine which ai-docs to load (similar logic as before, but only .md)
        if (fs.existsSync(configFilePath)) {
            const configContent = await fs.promises.readFile(configFilePath, 'utf8');
            const config = JSON.parse(configContent);
            if (config && Array.isArray(config.docs)) {
                docsToLoadNames = config.docs; // Use base names from config
                console.log(`⚙️ Using docs specified in config: ${docsToLoadNames.join(', ')}`);
            } else {
                 console.log(`⚙️ Config file found, but "docs" array is missing or invalid. Loading all docs.`);
                 if (fs.existsSync(aiDocsPath)) {
                    docsToLoadNames = (await fs.promises.readdir(aiDocsPath))
                        .filter(file => file.endsWith('.md'))
                        .map(file => file.replace(/\.md$/, '')); // Get base names
                 } else {
                    console.warn(`⚠️ ai-docs directory not found at ${aiDocsPath}. Cannot load all docs.`);
                 }
            }
        } else {
             console.log(`⚙️ Config file not found at ${configFilePath}. Loading all docs.`);
             if (fs.existsSync(aiDocsPath)) {
                 docsToLoadNames = (await fs.promises.readdir(aiDocsPath))
                     .filter(file => file.endsWith('.md'))
                     .map(file => file.replace(/\.md$/, '')); // Get base names
             } else {
                 console.warn(`⚠️ ai-docs directory not found at ${aiDocsPath}. Cannot load all docs.`);
             }
        }
    } catch (error) {
        console.warn(`⚠️ Error reading config file or ai-docs directory: ${error.message}. Skipping ai-docs.`);
    }

    // Read content of selected ai-docs files
    if (fs.existsSync(aiDocsPath)) {
        for (const docName of docsToLoadNames) {
            const content = await readOriginalRuleContent(path.join(aiDocsPath, `${docName}.md`)); // Read original .md
             if (content !== null) {
                allRuleContentsForMerging.push(content);
            }
        }
    } else if (docsToLoadNames.length > 0) {
         console.warn(`⚠️ ai-docs directory not found at ${aiDocsPath}, but specific docs were requested.`);
    }


    // Load local-ai-rules (local-ai-rules/*.md from output path)
    const localRulesReadPath = path.join(outputPath, 'local-ai-rules'); // Read from output path
    try {
        if (fs.existsSync(localRulesReadPath)) {
            const localFileNames = (await fs.promises.readdir(localRulesReadPath))
                .filter(file => file.endsWith('.md'))
                .map(file => file.replace(/\.md$/, '')); // Get base names

            for (const localName of localFileNames) {
                 // Read the original .md file from the local rules source directory
                 const content = await readOriginalRuleContent(path.join(localRulesReadPath, `${localName}.md`));
                 if (content !== null) {
                    allRuleContentsForMerging.push(content);
                }
            }
            console.log(`✅ Loaded local rules from ${localRulesReadPath} for merging`);
        } else {
            console.log(`ℹ️ No local-ai-rules directory found at ${localRulesReadPath}. Skipping local rules for merging.`);
        }
    } catch (error) {
        console.warn(`⚠️ Error reading local-ai-rules directory for merging: ${error.message}. Skipping local rules.`);
    }


    // --- Merge rules for copilot-instructions.md ---
    const finalMergedRules = allRuleContentsForMerging
        .filter(content => content && content.trim()) // Ensure content is not empty/whitespace
        .join('\n\n'); // Join non-empty parts with double newline

    // --- Write the merged rules ONLY to copilot-instructions.md ---
    await writeCopilotInstructionsFile(outputPath, finalMergedRules);


    // --- (Removed unnecessary directory copying logic) ---


    console.log('✨ Processing completed!');
  } catch (error) {
    console.error('❌ Processing failed:', error.message);
    if (error.stack) {
        console.error(error.stack); // Log stack trace for better debugging
    }
    process.exit(1);
  }
}

// Function to recursively copy a directory
async function copyDirectory(src, dest) {
  // Create output directory
  await fs.promises.mkdir(dest, { recursive: true });

  // Get contents of source directory
  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // If it's a directory, copy recursively
      await copyDirectory(srcPath, destPath);
    } else {
      // If it's a file, copy it
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

// Execute script
main().catch(console.error);
