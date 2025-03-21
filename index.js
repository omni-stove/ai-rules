#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const AdmZip = require('adm-zip');
const fetch = require('node-fetch');
require('dotenv').config();

// GitHub repository information
const OWNER = 'codynog';
const REPO = 'ai-rules';
const VERSION_FILE = '.ai-rules-version.json';

// Initialize Octokit client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

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
    console.log(`🔄 Downloading rules version ${version}...`);
    
    // Get the release assets instead of the tarball
    const { data: releases } = await octokit.repos.listReleases({
      owner: OWNER,
      repo: REPO,
      per_page: 10
    });
    
    // Find the release with the matching tag
    const targetRelease = releases.find(release => 
      release.tag_name === `v${version}` || release.tag_name === version
    );
    
    if (!targetRelease) {
      console.error(`❌ Could not find release for version ${version}`);
      return null;
    }
    
    // Get the zipball URL
    const zipballUrl = targetRelease.zipball_url;
    
    if (!zipballUrl) {
      console.error(`❌ No zipball URL found for version ${version}`);
      return null;
    }
    
    // Download the zipball
    const response = await fetch(zipballUrl, {
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3.raw'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download zipball: ${response.statusText}`);
    }
    
    // Get the response as a buffer
    let zipData;
    try {
      // Try buffer() method first (older node-fetch versions)
      zipData = await response.buffer();
    } catch (error) {
      // If buffer() is not available, use arrayBuffer() and convert to Buffer
      const arrayBuffer = await response.arrayBuffer();
      zipData = Buffer.from(arrayBuffer);
    }
    
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
    
    // Load src/index.md
    const indexMdPath = path.join(srcPath, 'index.md');
    let indexMdContent;
    
    try {
  indexMdContent = await fs.promises.readFile(indexMdPath, 'utf8');
    } catch (error) {
      console.error(`❌ Failed to load src/index.md: ${error.message}`);
      process.exit(1);
    }
    
    // Write the content of src/index.md to .clinerules and .cursorrules
    // Specify encoding to preserve the content as is
await fs.promises.writeFile(path.join(outputPath, '.clinerules'), indexMdContent, 'utf8');
await fs.promises.writeFile(path.join(outputPath, '.cursorrules'), indexMdContent, 'utf8');
    
    // Copy directories from src directory to output destination
    const srcEntries = await fs.promises.readdir(srcPath, { withFileTypes: true });
    
    for (const entry of srcEntries) {
      // Process directories only
      if (entry.isDirectory()) {
        const srcDirPath = path.join(srcPath, entry.name);
        const destDirPath = path.join(outputPath, entry.name);
        
    // Copy directory
    await copyDirectory(srcDirPath, destDirPath);
      }
    }
    
    console.log('✨ Processing completed!');
  } catch (error) {
    console.error('❌ Processing failed:', error.message);
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
