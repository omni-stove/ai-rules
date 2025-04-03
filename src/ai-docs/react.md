## React

### General Best Practices

- Use functional components
- Use React Hooks for state management and side effects
- Follow the single responsibility principle - each component should do one thing well
- Keep components small and focused
- Use meaningful component and variable names
- Avoid premature optimization
- Follow consistent coding conventions
- Document your components with JSDoc or similar
- Use useCallback for functions that depend on state and are passed as props to child components
- Use standard HTML event handler naming patterns like onClick for event handling functions in React components
- Avoid inline styles in React components and prefer CSS modules or styled-components for better maintainability
- Don't export component props directly; use `ComponentProps<typeof Component>` to derive prop types when needed in other components
