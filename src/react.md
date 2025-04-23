---
description: rules
globs: 
alwaysApply: false
---

# React

## General Best Practices

- Use functional components
- Use React Hooks for state management and side effects
- Follow the single responsibility principle - each component should do one thing well
- Keep components small and focused
- Use meaningful component and variable names
- Optimize thoughtfully when needed.
- Follow consistent coding conventions
- Document your components with JSDoc or similar
- Use useCallback for functions that depend on state and are passed as props to child components
- Use standard HTML event handler naming patterns like onClick for event handling functions in React components
- Prefer CSS modules or styled-components over inline styles for better maintainability.
- Derive prop types using `ComponentProps<typeof Component>` instead of exporting them directly when needed in other components.
