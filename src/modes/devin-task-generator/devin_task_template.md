---
name: Devin Task
about: Describe a task for the Devin agent based on the pre-planned Markdown list.
title: '[feature:task-id] Your Task Title Here'
labels: ''
assignees: ''

---

**Description:**

<!--
Provide a detailed description of the task steps based on the Markdown task list.
Copy the content from the `**Description:**` section of the corresponding task in the Markdown file.
-->

- Step 1
- Step 2
- ...

**Depends on:**

<!--
**Dependency Transformation Rules (Crucial!):**
1.  Find the `Depends on: #[dependency-task-id]` lines in the original Markdown task.
2.  For each `dependency-task-id`, find the corresponding GitHub Issue that was already created for that task.
3.  Get the actual issue number (e.g., 123) for that dependency issue.
4.  Convert the line to `Depends on: #<issue-number>` (e.g., `Depends on: #123`).
5.  List **each dependency on a separate line** using the `#<issue-number>` format.
6.  **Do not** use brackets (`[]`) or commas (`,`).

**Labeling Rule:**
- If the original Markdown task had **NO** `Depends on:` lines, leave this section blank AND **add the 'devin' label** to this issue using the labels field above.
- Otherwise, list the converted dependencies below and do **not** add the 'devin' label initially.

Example:
Depends on: #123
Depends on: #456
-->

**Additional Context:**

<!--
Add any other context or links relevant to the task.
Consider using `Related to #<issue_number>` for general relations or `Blocks #<issue_number>` if this task prevents another from starting.
-->
