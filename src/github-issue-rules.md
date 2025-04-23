---
description: rules
globs: 
alwaysApply: false
---

# GitHub Issue Creation Workflow for Agent Tasks

This document outlines the recommended workflow for creating and managing GitHub Issues intended for AI agents like Devin, leveraging Cline, MCP Server, and GitHub Actions for efficient task management and dependency tracking within this repository.

## 1. Planning and Task Decomposition (with Cline)

Before creating individual issues, it's crucial to plan the overall feature or task and break it down into smaller, manageable sub-tasks.

- Use Cline's PLAN MODE: Engage with Cline in PLAN MODE to collaboratively define the scope, implementation steps, component breakdown, and dependencies.
- Create a Markdown Task List: Document the decomposed tasks in a Markdown file (e.g., within `docs/issues/` or similar). This file serves as the blueprint for issue creation.
  - Commit the Plan: Commit this Markdown file to the repository to track the plan and provide context for future tasks.
- Task Format (in Markdown): Use a consistent format for each task in the Markdown file:

    ```markdown
    ### [feature:task-id] Task Title
    **(Example: [todo:be-db-schema] Define Todo DB Schema)**

    **Description:**
    - Detailed steps for the task...
    - More steps...

    **Depends on:** #[dependency-task-id]
    **(Example: Depends on: #[todo:be-setup])**
    *(List each dependency on a new line. Omit if none.)*
    ```

## 2. Automated Issue Creation (via Cline & MCP Server)

Manually creating issues for each decomposed task is tedious. Utilize Cline and the GitHub MCP Server to automate this process.

- Instruct Cline: Provide Cline with the path to the Markdown task list file created in the planning phase.
- Use `create_issue` Tool: Instruct Cline to use the GitHub MCP Server's `create_issue` tool for each task defined in the Markdown file.
- Mapping Rules: Ensure Cline follows these mapping rules when calling `create_issue`:
  - Issue Title: Use the task title from the Markdown heading (e.g., `[todo:be-db-schema] Define Todo DB Schema`).
  - Issue Body: Combine the `**Description:**` content and the `Depends on:` lines.
  - `Depends on:` Transformation (Crucial):
    - The `Depends on: #[dependency-task-id]` lines from the Markdown **must be converted** to `Depends on: #<issue-number>` in the final Issue body.
    - This requires mapping the `task-id` (e.g., `todo:be-db-schema`) to the actual GitHub Issue number created for that dependency *before* creating the dependent issue. (This might involve creating issues sequentially or in batches where dependencies are known).
    - List **each dependency on a separate line** using the `#<issue-number>` format.
    - **Do not** use brackets (`[]`) or commas (`,`).
    - Example (in final Issue Body):

        ```markdown
        **Description:**
        - Detailed steps...

        Depends on: #123
        Depends on: #456
        ```

  - **Labels:**
    - Add relevant labels (e.g., `bug`, `enhancement`, `refactoring`, `documentation`).
    - **`devin` label:** Apply this label **only** if the original task in the Markdown file had **no** `Depends on:` lines (i.e., it's a starting point).

## 3. Workflow Automation (GitHub Actions)

Once issues are created with the correct dependencies and initial `devin` labels:

- Devin Trigger: A separate GitHub Action (e.g., `Devin Task Automation`) should trigger when an issue receives the `devin` label, initiating the Devin agent process for that task.
- Dependency Management: The `label-dependent-devin-issues` workflow (if implemented in this repository) monitors `devin`-labeled issues. When one is closed:
  - It finds dependent issues.
  - If other dependencies remain, it removes the closed dependency line from the issue body.
  - If it was the *last* dependency, it adds the `devin` label to the now-unblocked issue, triggering the next Devin task via the `Devin Task Automation` workflow (likely using `repository_dispatch`).

## 4. Other Link Types

- Use `Related to #<issue_number>` for general relations.
- Use `Blocks #<issue_number>` if an issue prevents another from starting (distinct from `Depends on:` which implies a required completion order).

By following this workflow, you can leverage automation to manage complex task dependencies and efficiently utilize AI agents like Devin.
