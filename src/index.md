# rules

## general

- If tests fail more than twice, check the current situation with the user
- Follow the project's rules for Lint and Format
- First, read [local-ai-rules/index.md](./local-ai-rules/index.md) to understand the repository structure
- Load documents from [ai-docs](./ai-docs) directory according to the required technology
- If there are no relevant documents in ai-docs, load documents from [local-ai-rules/docs](./local-ai-rules/docs) directory
- If there are conflicts between [ai-docs] and [local-ai-rules/docs] content, prioritize local
- If there are file generators, use them to generate files

## specific

### TypeScript

- Use TypeScript
- Use `type` instead of `interface`
- Use `const` instead of `let`
- Do not use the class syntax unless there is an existing implementation, or unless specifically instructed to do so
- Avoid using `any` type as much as possible
- If there are import issues, ignore them temporarily and fix them by formatting when the task is completed
