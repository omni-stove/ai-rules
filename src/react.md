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
- Use descriptive names for event handlers with consistent patterns. Start with the event type (e.g., "onClick", "onChange", "onSubmit") and add descriptive suffixes when multiple similar handlers exist (e.g., `onClickSave`, `onClickCancel`, `onChangeEmail`, `onChangePassword`, `onSubmitForm`, `onSubmitLogin`)
- Prefer CSS modules over inline styles for better maintainability.
- Derive prop types using `ComponentProps<typeof Component>` instead of exporting them directly when needed in other components.

## Component Architecture

- Avoid creating components solely for visual commonality - focus on functional purpose instead
- Prioritize styling with existing UI library components over custom wrapper components
- Design components based on domain models and business logic rather than just visual patterns
- Use Object-Oriented User Interface (OOUI) principles - design components that represent real-world objects and concepts
- When creating component-specific custom hooks, accept the full Props object and handle internal property division within the hook
