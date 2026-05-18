# Contributing to GIA

First off, thank you for considering contributing to GIA! It's people like you who make GIA such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. Please report unacceptable behavior to [support@alpha1studio.com].

## How Can I Contribute?

### Reporting Bugs

* **Check the Issues:** See if the bug has already been reported.
* **Be Specific:** Provide as much detail as possible, including steps to reproduce, the device/platform, and your current GIA version.
* **Include Logs:** If possible, copy the relevant logs from the "Engine Room" or console.

### Suggesting Enhancements

* **Open an Issue:** Describe the feature you'd like to see and why it would be useful.
* **Draft a Spec:** If it's a major feature, consider writing a small design doc (similar to `gia-become-claude-spec.md`).

### Pull Requests

1. **Fork the repo** and create your branch from `main`.
2. **Install dependencies** with `npm install`.
3. **Follow the style:** We use ESLint and Prettier. Run `npm run lint` before committing.
4. **Test your changes:** Ensure the app builds with `npm run build`.
5. **Issue a PR:** Provide a clear description of your changes and reference any related issues.

## Engineering Standards

* **Local-First:** Never add dependencies that require a central cloud backend.
* **Privacy-Centric:** No telemetry or data collection.
* **Type Safety:** Maintain 100% TypeScript coverage. Avoid `any` at all costs.
* **Performance:** Keep the agentic loop efficient and ensure smooth UI transitions (Framer Motion).

## Style Guide

* Use functional components and hooks.
* Use Tailwind CSS v4 for all styling.
* Prefer Lucide icons for consistency.
* Document complex logic in `GiaBrain.ts` or relevant services.

Happy coding!
