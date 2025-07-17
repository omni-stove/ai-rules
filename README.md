# cody-ai-rules

A repository that manages the common foundation for AI rules.
Also publishes CLI tool scripts to Github Packages.
Each repository can obtain the latest version of common rules by executing `@omni-stove/ai-rules` (Node.js).

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
   @omni-stove:registry=https://npm.pkg.github.com
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
.clinerules
.cursorrules
.ai-rules-version.json
.github/copilot-instructions.md
.claude
CLAUDE.personal.md
```

**Note for Claude Code users**: 
- Copy `.claude/CLAUDE.example.md` to your project root as `CLAUDE.md` for your main configuration
- Copy `.claude/CLAUDE.personal.md` to your project root as `CLAUDE.personal.md` for personal settings (this file is git-ignored)
- The main `CLAUDE.md` should import personal configuration using `@CLAUDE.personal.md`

## Claude Code Setup Instructions

### For Team Leads (Setting up team configuration)

1. Run the CLI tool to generate configuration files:
   ```bash
   npm install @omni-stove/ai-rules
   npx @omni-stove/ai-rules
   ```

2. Copy the generated main configuration:
   ```bash
   cp .claude/CLAUDE.example.md CLAUDE.md
   ```

3. Customize `CLAUDE.md` for your team's needs and commit it to the repository.

### For Team Members (Setting up personal configuration)

1. Ensure the repository has `CLAUDE.md` in the project root

2. Create your personal configuration:
   ```bash
   cp .claude/CLAUDE.personal.md CLAUDE.personal.md
   ```

3. Customize `CLAUDE.personal.md` with your personal preferences (personas, personal settings, etc.). This file is git-ignored and won't be shared.

4. The main `CLAUDE.md` automatically imports personal settings via `@CLAUDE.personal.md`

### Node.js Version

Install the package:

```bash
npm install @omni-stove/ai-rules
```

Incorporating CLI execution into postinstall will automatically download the latest rules:

```json
"postinstall": "@omni-stove/ai-rules"
```

Place the local-ai-rules directory at the root and add repository-specific rules that are not common rules.

.clineignore and .cursorignore should be configured for each repository.

## Directory Structure

### index.js

A script that converts [rules](./src/index.md) to various formats.
Currently supports:
- `.clinerules/*.md` (Cline)
- `.cursor/rules/*.mdc` (Cursor)
- `.roo/rules/*.md` (Roo)
- `.claude/rules/*.md`, `CLAUDE.example.md`, and `CLAUDE.personal.md` (Claude Code)
- `.github/copilot-instructions.md` (GitHub Copilot)

### src

Contains index.md, which is the source of all AI rules, and detailed documents on various technical matters are placed under ai-docs.

#### src/index.md

The source file for all AI rules.
This is used as the basis for conversion to various formats.

#### src/ai-docs

Contains detailed documents on various technical matters.
The documents are split to consider the context window size and to load appropriate documents for each task.
