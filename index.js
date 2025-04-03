#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
require('dotenv').config();

// GitHub repository information
const OWNER = 'codynog';
const REPO = 'ai-rules';
const VERSION_FILE = '.ai-rules-version.json'; // Removed dot prefix

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

    // If we're not in local mode, handle version management
    if (!isLocalMode) {
      if (latestVersion) {
        // If versions don't match and we have a latest version, download and use the latest rules
        if (currentVersion !== latestVersion) {
          console.log(`🔄 Version mismatch: current=${currentVersion || 'none'}, latest=${latestVersion}`);

          const extractPath = await downloadLatestRules(latestVersion, baseDir);
          if (extractPath) {
            // Find the src directory in the extracted files
            const extractedDirs = await fs.promises.readdir(extractPath, { withFileTypes: true });
            const repoDir = extractedDirs.find(dir => dir.isDirectory());

            if (repoDir) {
              srcPath = path.join(extractPath, repoDir.name, 'src');
              console.log(`✅ Using rules from downloaded version: ${latestVersion}`);
            } else {
              console.error('❌ Could not find repository directory in extracted files');
              // Fallback to local src if extraction failed to find the dir
              srcPath = path.join(baseDir, 'src');
              console.warn('⚠️ Falling back to local src directory.');
            }
          } else {
             // Fallback to local src if download failed
             srcPath = path.join(baseDir, 'src');
             console.warn('⚠️ Download failed. Falling back to local src directory.');
          }
        } else {
          console.log(`✅ Already using the latest version: ${currentVersion}`);
          // Ensure srcPath points to local src if using current version
          srcPath = path.join(baseDir, 'src');
        }

        // Always update the version file in default mode if a latest version was determined
        await updateVersionFile(outputPath, latestVersion);
      } else {
        console.log('⚠️ Could not determine latest version, using local files');
        // Ensure srcPath points to local src if latest version check failed
        srcPath = path.join(baseDir, 'src');
      }
    } else {
      console.log('ℹ️ Using local mode, skipping version check');
      // Ensure srcPath points to local src in local mode
      srcPath = path.join(baseDir, 'src');
    }

    // Load src/index.md
    const indexMdPath = path.join(srcPath, 'index.md');
    let baseRulesContent = ''; // Initialize with empty string
    try {
      // Check if srcPath and indexMdPath exist before reading
      if (fs.existsSync(srcPath) && fs.existsSync(indexMdPath)) {
          baseRulesContent = await fs.promises.readFile(indexMdPath, 'utf8');
          console.log(`✅ Loaded base rules from ${indexMdPath}`);
      } else {
          console.warn(`⚠️ Base rules file not found at ${indexMdPath}. Continuing without base rules.`);
      }
    } catch (error) {
      // If index.md doesn't exist or other error, log a warning but continue
      console.warn(`⚠️ Failed to load base rules from ${indexMdPath}: ${error.message}. Continuing without base rules.`);
    }

    // --- Load ai-docs ---
    let aiDocsContent = '';
    const aiDocsPath = path.join(srcPath, 'ai-docs');
    const configFilePath = path.join(outputPath, 'ai-rules-config.json');
    let docsToLoad = [];

    try {
      // Check for config file
      if (fs.existsSync(configFilePath)) {
        const configContent = await fs.promises.readFile(configFilePath, 'utf8');
        const config = JSON.parse(configContent);
        if (config && Array.isArray(config.docs)) {
          docsToLoad = config.docs.map(docName => `${docName}.md`); // Add .md extension
          console.log(`⚙️ Using docs specified in config: ${docsToLoad.join(', ')}`);
        } else {
          console.log(`⚙️ Config file found, but "docs" array is missing or invalid. Loading all available docs from ${aiDocsPath}.`);
          // Check if aiDocsPath exists before reading
          if (fs.existsSync(aiDocsPath)) {
             docsToLoad = (await fs.promises.readdir(aiDocsPath)).filter(file => file.endsWith('.md'));
          } else {
             console.warn(`⚠️ ai-docs directory not found at ${aiDocsPath}. Cannot load all docs.`);
             docsToLoad = [];
          }
        }
      } else {
        console.log(`⚙️ Config file not found at ${configFilePath}. Loading all available docs from ${aiDocsPath}.`);
        // Load all .md files if config doesn't exist or doesn't specify docs
        // Check if aiDocsPath exists before reading
        if (fs.existsSync(aiDocsPath)) {
           docsToLoad = (await fs.promises.readdir(aiDocsPath)).filter(file => file.endsWith('.md'));
        } else {
           console.warn(`⚠️ ai-docs directory not found at ${aiDocsPath}. Cannot load all docs.`);
           docsToLoad = [];
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error reading config file or ai-docs directory: ${error.message}. Skipping ai-docs.`);
      docsToLoad = []; // Reset docsToLoad on error
    }

    // Read content of selected ai-docs files
    const aiDocsContents = [];
    // Ensure aiDocsPath exists before trying to read files from it
    if (fs.existsSync(aiDocsPath)) {
        for (const docFile of docsToLoad) {
          const docPath = path.join(aiDocsPath, docFile);
          try {
            // Check if the specific doc file exists before reading
            if (fs.existsSync(docPath)) {
              const content = await fs.promises.readFile(docPath, 'utf8');
              aiDocsContents.push(content);
              console.log(`✅ Loaded ai-doc: ${docFile}`);
            } else {
              console.warn(`⚠️ Specified ai-doc not found: ${docFile} at ${docPath}`);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to load ai-doc ${docFile}: ${error.message}`);
          }
        }
    } else if (docsToLoad.length > 0) {
        // Warn if docs were specified but the directory doesn't exist
        console.warn(`⚠️ ai-docs directory not found at ${aiDocsPath}, but specific docs were requested.`);
    }
    aiDocsContent = aiDocsContents.join('\n\n'); // Join with double newline for separation

    // --- Load local-ai-rules ---
    let localRulesContent = '';
    const localRulesPath = path.join(outputPath, 'local-ai-rules'); // Look in output path
    try {
      if (fs.existsSync(localRulesPath)) {
        const localFiles = (await fs.promises.readdir(localRulesPath)).filter(file => file.endsWith('.md'));
        const localContents = [];
        for (const localFile of localFiles) {
          const localFilePath = path.join(localRulesPath, localFile);
          try {
            // Check if file exists before reading
            if (fs.existsSync(localFilePath)) {
                const content = await fs.promises.readFile(localFilePath, 'utf8');
                localContents.push(content);
                console.log(`✅ Loaded local rule: ${localFile}`);
            } else {
                console.warn(`⚠️ Local rule file not found: ${localFile} at ${localFilePath}`);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to load local rule ${localFile}: ${error.message}`);
          }
        }
        localRulesContent = localContents.join('\n\n'); // Join with double newline
        console.log(`✅ Loaded local rules from ${localRulesPath}`);
      } else {
        console.log(`ℹ️ No local-ai-rules directory found at ${localRulesPath}. Skipping local rules.`);
      }
    } catch (error) {
      console.warn(`⚠️ Error reading local-ai-rules directory: ${error.message}. Skipping local rules.`);
    }

    // --- Merge all rules ---
    const finalRules = [
      baseRulesContent,
      aiDocsContent,
      localRulesContent
    ].filter(content => content && content.trim()).join('\n\n'); // Join non-empty parts with double newline

    // Write the merged content to .clinerules and .cursorrules
    await fs.promises.writeFile(path.join(outputPath, '.clinerules'), finalRules, 'utf8');
    await fs.promises.writeFile(path.join(outputPath, '.cursorrules'), finalRules, 'utf8');
    console.log('✅ Created merged .clinerules and .cursorrules files');

    // --- Copy other directories ---
    // Copy directories from the source *other than* index.md and ai-docs
    // Ensure srcPath exists before trying to read from it
    if (fs.existsSync(srcPath)) {
        const srcEntries = await fs.promises.readdir(srcPath, { withFileTypes: true });

        for (const entry of srcEntries) {
          // Skip files/dirs handled above or potentially problematic ones
          if (entry.name === 'index.md' || entry.name === 'ai-docs') {
              continue;
          }

          const srcEntryPath = path.join(srcPath, entry.name);
          const destEntryPath = path.join(outputPath, entry.name);

          try {
              // Check if source entry exists before copying
              if (fs.existsSync(srcEntryPath)) {
                  if (entry.isDirectory()) {
                      // Copy directory recursively
                      await copyDirectory(srcEntryPath, destEntryPath);
                      console.log(`✅ Copied directory: ${entry.name}`);
                  } else if (entry.isFile()) {
                      // Optionally copy other top-level files if needed
                      // await fs.promises.copyFile(srcEntryPath, destEntryPath);
                      // console.log(`✅ Copied file: ${entry.name}`);
                  }
              } else {
                  console.warn(`⚠️ Source entry not found, skipping copy: ${srcEntryPath}`);
              }
          } catch (copyError) {
              console.warn(`⚠️ Failed to copy ${entry.isDirectory() ? 'directory' : 'file'} ${entry.name}: ${copyError.message}`);
          }
        }
    } else {
        console.warn(`⚠️ Source directory not found, skipping copy of other directories: ${srcPath}`);
    }


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
  // Create output directory if it doesn't exist
  await fs.promises.mkdir(dest, { recursive: true });

  // Get contents of source directory
  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Check if source path exists before proceeding
    if (fs.existsSync(srcPath)) {
        if (entry.isDirectory()) {
          // If it's a directory, copy recursively
          await copyDirectory(srcPath, destPath);
        } else {
          // If it's a file, copy it
          await fs.promises.copyFile(srcPath, destPath);
        }
    } else {
        console.warn(`⚠️ Source path not found during copy, skipping: ${srcPath}`);
    }
  }
}

// Execute script
main().catch(console.error);
