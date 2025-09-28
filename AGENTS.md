# Agent Development Guide

This document serves as a guide for AI coding agents working on the Inbox Triage Extension. Its purpose is to ensure that agents understand where to find requirements and how to approach development in a consistent, maintainable way.

## Where to start

- **Read the specification**: Start by reading `SPEC.md`. It contains the complete functional and technical requirements for the extension, including architecture, API usage, and UX expectations. Do not begin coding until you understand the requirements.
- **Check the README**: The root `README.md` provides a high‑level overview, project structure, installation steps, and links to other documentation.
- **Track tasks**: The `TODO.md` file lists outstanding tasks and their status. Keep it up to date as you complete work or create new items.

## Development principles

- **Follow MV3 best practices**: Use Manifest V3 for extension architecture. Keep content scripts, background scripts, and UI code separate.
- **On‑device AI only**: All AI processing must happen locally via Chrome’s built‑in APIs (Summarizer, Prompt, etc.). Do not introduce external API calls or server dependencies.
- **Maintainability**: Write clean, modular code. Use descriptive function and variable names. Keep side effects contained and avoid global state.
- **Performance**: Optimise DOM queries and avoid expensive operations in loops. Keep response times quick for a smooth user experience.
- **Error handling**: Always check availability of built‑in APIs. Provide user‑friendly error messages and fallback behaviour if models are unavailable or still downloading.
- **Security and privacy**: Respect user privacy by never sending data off device. Request only the minimum permissions needed in the manifest.
- **British English**: When generating user‑visible text (e.g., labels, descriptions), use British English.

## Workflow

1. Pick a task from `TODO.md` or the issue tracker.
2. Review the relevant sections in `SPEC.md` and existing code.
3. Implement the feature in a new branch, following the above principles.
4. Update `TODO.md` to reflect progress, and create or comment on issues as needed.
5. Open a pull request for review once the task is complete.

By adhering to this guide, agents will produce consistent, high‑quality contributions that align with the project’s goals and constraints.
