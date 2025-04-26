# Markdown Task List Format Guide

When creating a Markdown task list in Task Planner mode, please follow this format, based on `github-issue-rules.md`.

- **Task Title:** Start each task with a level 3 header (`###`) using the following format:
  ```markdown
  ### [feature:task-id] Task Title
  ```
  - `feature`: The category or feature of the task (e.g., `todo`, `auth`, `ui`).
  - `task-id`: A unique identifier for the task (e.g., `be-setup`, `login-form`).
  - `Task Title`: A specific description of the task.

- **Description:** Below the title, add a `**Description:**` heading and list the detailed steps for the task using bullet points.
  ```markdown
  **Description:**
  - Step 1
  - Step 2
  ```

- **Dependencies:** Below the description, add a `Depends on:` heading and list the IDs of any tasks this task depends on, using the following format. If there are no dependencies, omit this section.
  ```markdown
  Depends on: #[dependency-task-id]
  ```
  - `dependency-task-id`: The `task-id` of the task it depends on (e.g., `be-setup`).
  - If there are multiple dependencies, list each one on a new line.
