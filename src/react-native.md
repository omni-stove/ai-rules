---
description: rules
globs: 
alwaysApply: false
---

# React Native

## Base React Rules

See [React rules](./react.md) for general React best practices that also apply to React Native.

## Core Rules

- Use functional components with TypeScript
- Use StyleSheet.create() for styles, never inline styles
- Use FlatList for lists, not ScrollView with map
- Handle iOS/Android differences with Platform.select()
- Use React Navigation for navigation
- Type all props including navigation props