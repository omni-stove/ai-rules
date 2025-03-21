# cody-ai-rules

A repository that manages the common foundation for AI rules.
Also publishes CLI tool scripts to Github Packages.
Each repository can obtain the latest version of common rules by executing `@codynog/ai-rules` (Node.js).

## Automatic Release

This repository automatically releases a new version of the package to GitHub Packages whenever there are changes to the `src` directory. This ensures that the latest AI rules are always available for other projects.

Releases are automatically performed under the following conditions:

- When pushing to the `main` branch with changes to `src/**`, `index.js`, or `.github/**`
- When manually executed from the "Actions" tab in GitHub Actions

Versioning uses CalVer (Calendar Versioning), and versions are automatically generated in the format `YYYY.MM.RELEASE_COUNT`. For example, the first release in March 2025 would be `2025.3.1`.

## Installation

### For Developers (when editing this repository)

If you don't need to adjust the script itself, you can simply edit the documents and commit them

1. Setup

   ```bash
   npm run setup
   ```

2. Copy the `.npmrc.example` file to `.npmrc` and set your GitHub Personal Access Token

   ```plaintext
   @codynog:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=your_github_personal_access_token
   ```

> **Note**: GitHub Personal Access Token requires at least the `read:packages` scope. If you need to publish packages, the `write:packages` scope is also required.

### Settings Required to Run the CLI Tool

1. Rename the `.env.example` file to `.env`
2. Edit the `.env` file to set your GitHub Personal Access Token

   ```plaintext
   GITHUB_TOKEN=your_github_personal_access_token
   ```

3. To run the CLI tool:

   ```bash
   node index.js
   ```

   Or, to run with a specified output destination:

   ```bash
   node index.js --output /path/to/output
   ```

## Preparation for CLI Users

Add the following to .gitignore

```plaintext
ai-docs/**
.cursorrules
.clinerules
.ai-rules-version.json
```

### Node.js Version

Install the package:

```bash
npm install @codynog/ai-rules
```

Incorporating CLI execution into postinstall will automatically download the latest rules:

```json
"postinstall": "@codynog/ai-rules"
```

Place the local-ai-rules directory at the root and add repository-specific rules that are not common rules.

.clineignore and .cursorignore should be configured for each repository.

## Directory Structure

### index.js

A script that converts [rules](./src/index.md) to various formats.
Currently covers .clinerules and .cursorrules.

### src

Contains index.md, which is the source of all AI rules, and detailed documents on various technical matters are placed under ai-docs.

#### src/index.md

The source file for all AI rules.
This is used as the basis for conversion to various formats.

#### src/ai-docs

Contains detailed documents on various technical matters.
The documents are split to consider the context window size and to load appropriate documents for each task.
