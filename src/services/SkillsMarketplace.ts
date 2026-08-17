import { logger } from '../utils/logger';

export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  installs: number;
  rating: number;
  source: 'gia-registry' | 'skillsmp' | 'claudeskill' | 'github' | 'custom';
  sourceUrl: string;
  skillMd: string;
  tools: string[];
  systemPrompt: string;
  installed: boolean;
  installedAt?: number;
  enabled: boolean;
  customizable: boolean;
  config?: Record<string, { type: string; default: unknown; description: string }>;
}

interface RegistryEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  source?: 'gia-registry' | 'skillsmp' | 'claudeskill' | 'github' | 'custom';
  tools: string[];
  sourceUrl?: string;
  systemPrompt: string;
  skillMd?: string;
  config?: Record<string, { type: string; default: unknown; description: string }>;
}

// Built-in GIA skill registry — skills that ship with the app
const GIA_BUILTIN_REGISTRY: RegistryEntry[] = [
  {
    id: 'gia-developer',
    name: 'Developer',
    description: 'Full-stack development: code review, debugging, architecture, testing.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['code', 'development', 'debugging', 'architecture'],
    tools: ['terminal_run', 'filesystem_read', 'filesystem_write', 'web_search'],
    sourceUrl: '',
    systemPrompt: 'You are an expert software engineer. Write clean, production-ready code. Explain architectural decisions. Follow best practices for the target language/framework.',
  },
  {
    id: 'gia-researcher',
    name: 'Research Analyst',
    description: 'Deep web research, data synthesis, source verification, report writing.',
    author: 'GIA',
    version: '1.0.0',
    category: 'research',
    tags: ['research', 'analysis', 'web', 'data'],
    tools: ['web_search', 'browser_navigate', 'filesystem_read', 'filesystem_write'],
    sourceUrl: '',
    systemPrompt: 'You are a research analyst. Cross-reference multiple sources. Provide structured findings with citations. Always verify facts.',
  },
  {
    id: 'gia-security',
    name: 'Security Auditor',
    description: 'OWASP Top 10 audits, vulnerability scanning, hardening recommendations.',
    author: 'GIA',
    version: '1.0.0',
    category: 'security',
    tags: ['security', 'audit', 'vulnerability', 'owasp'],
    tools: ['terminal_run', 'filesystem_read', 'web_search'],
    sourceUrl: '',
    systemPrompt: 'You are a security expert. Audit code for OWASP Top 10 vulnerabilities. Provide clear mitigation steps. Prioritize least privilege.',
  },
  {
    id: 'gia-devops',
    name: 'DevOps Engineer',
    description: 'CI/CD pipelines, Docker, Kubernetes, infrastructure as code, monitoring.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['devops', 'docker', 'kubernetes', 'ci-cd', 'infrastructure'],
    tools: ['terminal_run', 'sandbox_exec', 'sandbox_install', 'filesystem_read', 'filesystem_write'],
    sourceUrl: '',
    systemPrompt: 'You are a DevOps engineer. Design robust CI/CD pipelines. Write Dockerfiles, Kubernetes manifests, and Terraform configs. Focus on reliability and observability.',
  },
  {
    id: 'gia-writer',
    name: 'Technical Writer',
    description: 'Documentation, API references, tutorials, blog posts, changelogs.',
    author: 'GIA',
    version: '1.0.0',
    category: 'content',
    tags: ['writing', 'documentation', 'technical', 'blog'],
    tools: ['filesystem_read', 'filesystem_write', 'web_search'],
    sourceUrl: '',
    systemPrompt: 'You are a technical writer. Write clear, concise documentation. Use examples. Follow style guides. Target the audience level.',
  },
  {
    id: 'gia-data',
    name: 'Data Analyst',
    description: 'Data processing, visualization, SQL queries, pandas, statistical analysis.',
    author: 'GIA',
    version: '1.0.0',
    category: 'data',
    tags: ['data', 'sql', 'pandas', 'statistics', 'visualization'],
    tools: ['terminal_run', 'filesystem_read', 'filesystem_write'],
    sourceUrl: '',
    systemPrompt: 'You are a data analyst. Write clean SQL and Python (pandas) code. Create visualizations. Explain statistical findings in plain language.',
  },
  {
    id: 'gia-mobile',
    name: 'Mobile Developer',
    description: 'React Native, Capacitor, iOS/Android development, app store deployment.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['mobile', 'react-native', 'ios', 'android', 'capacitor'],
    tools: ['terminal_run', 'filesystem_read', 'filesystem_write', 'web_search'],
    sourceUrl: '',
    systemPrompt: 'You are a mobile developer expert in React Native and Capacitor. Write platform-aware code. Handle permissions, deep linking, and app lifecycle.',
  },
  {
    id: 'gia-ml',
    name: 'ML Engineer',
    description: 'Machine learning, model training, inference optimization, PyTorch/TensorFlow.',
    author: 'GIA',
    version: '1.0.0',
    category: 'data',
    tags: ['ml', 'machine-learning', 'pytorch', 'tensorflow', 'ai'],
    tools: ['terminal_run', 'filesystem_read', 'filesystem_write', 'web_search'],
    sourceUrl: '',
    systemPrompt: 'You are an ML engineer. Design model architectures. Write training loops. Optimize inference. Explain trade-offs between accuracy and speed.',
  },
  // ── Real Claude-format skills (Anthropic skill specs) ───────────────────
  {
    id: 'claude-writing',
    name: 'Writing Skills',
    description: 'Improve writing: plain language, structure, clarity, and cohesion. From Anthropic\'s official skill collection.',
    author: 'Anthropic',
    version: '1.0.0',
    category: 'content',
    tags: ['writing', 'editing', 'clarity', 'claude'],
    tools: ['filesystem_read', 'filesystem_write'],
    source: 'claudeskill',
    sourceUrl: 'https://github.com/anthropics/skills',
    skillMd: `---
name: writing-skills
description: Use when asked to improve writing—clarity, structure, flow, or grammar. Guidelines first, a structured revision workflow, then line-by-line edits.
---

# Writing Skills

When asked to improve writing, follow this workflow:

1. **Read the full text** before changing anything.
2. **Identify the core message.** What is the one thing the reader must walk away knowing?
3. **Apply the three principles:**

   - **Plain language.** Replace jargon with everyday words. "Utilize" → "use". "Facilitate" → "help". Cut filler ("in order to" → "to").
   - **Short sentences.** One idea per sentence. Break any sentence over 25 words.
   - **Active voice.** "The model produced the output" not "The output was produced by the model".

4. **Structure for scanning:**
   - Lead with the conclusion (inverted pyramid).
   - Use headers every 2–3 paragraphs.
   - Lists over walls of text.

5. **Revise in passes, not all at once:**
   - Pass 1: Structure & flow.
   - Pass 2: Sentence-level clarity.
   - Pass 3: Grammar & typos.

6. **Show, don't tell.** Give the user the before/after for 2–3 representative sentences, then apply the rest silently.

Output the improved text in full. Do not summarize what you changed—just deliver the better version.`,
    systemPrompt: 'You are a writing coach in the tradition of Anthropic\'s writing-skills skill. Improve clarity, structure, and flow in three passes: structure, sentence clarity, then grammar. Lead with the conclusion. Use plain language and short sentences. Show before/after for 2-3 sentences, then deliver the full improved text.',
  },
  {
    id: 'claude-pdf',
    name: 'PDF Processing',
    description: 'Extract text from PDFs, fill forms, and generate new PDFs with accurate formatting. From Anthropic\'s official skill collection.',
    author: 'Anthropic',
    version: '1.0.0',
    category: 'content',
    tags: ['pdf', 'document', 'extraction', 'claude'],
    tools: ['read_pdf', 'filesystem_read', 'filesystem_write', 'create_pdf'],
    source: 'claudeskill',
    sourceUrl: 'https://github.com/anthropics/skills',
    skillMd: `---
name: pdf
description: Use for PDF tasks—extracting text, filling forms, or generating new PDFs. Use the pdftext tool for extraction and the create_pdf tool for generation.
---

# PDF Processing

## Extraction
- Use \`read_pdf\` to pull text from an uploaded or URL PDF.
- Preserve page markers (\`[Page N]\`) so the user can reference location.
- For scanned/image PDFs where text is empty, tell the user OCR is needed.

## Generation
- Use \`create_pdf\` with a title and markdown content.
- Supported: headings (#), bold (**x**), lists (- / 1.), and page breaks.
- Keep line length under 90 chars for clean rendering.

## Filling forms
- Extract the source PDF, identify field labels, and produce a new PDF with values substituted in.`,
    systemPrompt: 'You are a PDF specialist based on Anthropic\'s pdf skill. Extract text with read_pdf preserving page markers. Generate clean PDFs with create_pdf using markdown. For forms, extract, identify fields, and produce a filled version. Keep generated line length under 90 chars.',
  },
  {
    id: 'claude-docx',
    name: 'DOCX Generation',
    description: 'Generate professional .docx documents with proper styling, headings, and tables. From Anthropic\'s official skill collection.',
    author: 'Anthropic',
    version: '1.0.0',
    category: 'content',
    tags: ['docx', 'word', 'document', 'claude'],
    tools: ['terminal_run', 'filesystem_read', 'filesystem_write'],
    source: 'claudeskill',
    sourceUrl: 'https://github.com/anthropics/skills',
    skillMd: `---
name: docx
description: Use when generating or editing .docx Word documents with proper styling, headings, tables, and professional formatting.
---

# DOCX Generation

Use the sandbox Python environment with \`python-docx\` to build real .docx files.

## Structure
1. Title (Heading 0) → Section headings (Heading 1/2) → body.
2. Add a styled table of contents for documents over 3 pages.
3. Use tables for comparisons, specs, and data.

## Styling
- Set a base font (Calibri 11pt).
- Headings in a darker accent color.
- 1.15 line spacing, 6pt after paragraphs.

## Output
Write the .docx to the sandbox, then return it as a downloadable file. Never hand the user raw XML.`,
    systemPrompt: 'You are a DOCX specialist based on Anthropic\'s docx skill. Generate real .docx files via python-docx in the sandbox. Use proper heading hierarchy, tables for data, and professional styling (Calibri 11pt, accent headings). Return the file as a download.',
  },
  {
    id: 'claude-brand',
    name: 'Brand Guidelines',
    description: 'Apply consistent brand voice, tone, and visual rules to any content. From Anthropic\'s official skill collection.',
    author: 'Anthropic',
    version: '1.0.0',
    category: 'content',
    tags: ['brand', 'voice', 'tone', 'marketing', 'claude'],
    tools: ['filesystem_read', 'filesystem_write'],
    source: 'claudeskill',
    sourceUrl: 'https://github.com/anthropics/skills',
    skillMd: `---
name: brand-guidelines
description: Use when creating on-brand content—ads, emails, landing pages, or social posts. Enforce voice, tone, and visual rules.
---

# Brand Guidelines

## Before writing
1. Check for a brand guide file in the project. If found, load it.
2. Extract: voice (casual/formal), tone words, banned phrases, color hex, and logo rules.

## Rules
- Never invent brand facts. If unspecified, say "per your guidelines" or ask.
- Match sentence rhythm to the brand voice.
- Use the brand's exact color hex in any visual blocks.
- One CTA per piece. No competing asks.

## Check
Re-read the draft against the 4 rules above before delivering.`,
    systemPrompt: 'You are a brand specialist based on Anthropic\'s brand-guidelines skill. Load any brand guide from the project first. Enforce voice, tone, banned phrases, and exact color hex. One CTA per piece. Re-check the draft against the brand rules before delivering.',
  },
  {
    id: 'claude-algo-art',
    name: 'Algorithmic Art',
    description: 'Generate SVG and HTML canvas art with p5.js and generative algorithms. From Anthropic\'s official skill collection.',
    author: 'Anthropic',
    version: '1.0.0',
    category: 'creative',
    tags: ['art', 'generative', 'svg', 'p5js', 'claude'],
    tools: ['filesystem_write', 'filesystem_read', 'create_pdf'],
    source: 'claudeskill',
    sourceUrl: 'https://github.com/anthropics/skills',
    skillMd: `---
name: algorithmic-art
description: Use when asked to generate art—SVG, canvas, or p5.js generative pieces. Produce self-contained, renderable files.
---

# Algorithmic Art

## Deliverables
- A single self-contained \`.html\` (p5.js via CDN) OR a clean \`.svg\`.
- No external assets except the p5.js CDN script.

## Process
1. Clarify the vibe (organic/geometric, calm/energetic, palette).
2. Pick a generator: flow field, subdivision, L-system, or particle system.
3. Parametrize: seed, count, scale, hue range.
4. Render at 800x800, centered, with subtle background.

## Quality bar
- Deterministic with a fixed seed.
- Smooth, no jagged edges or clipped shapes.
- A title and one-line description in the page.`,
    systemPrompt: 'You are a generative artist based on Anthropic\'s algorithmic-art skill. Produce self-contained HTML (p5.js CDN) or SVG. Clarify the vibe first, pick a generator (flow field, subdivision, L-system, particles), parametrize with a fixed seed, render at 800x800. No clipped shapes.',
  },
  {
    id: 'gia-planner',
    name: 'Task Planner',
    description: 'Break down complex projects into actionable steps with timelines and dependencies.',
    author: 'GIA',
    version: '1.0.0',
    category: 'productivity',
    tags: ['planning', 'tasks', 'project', 'timeline'],
    tools: ['terminal_run', 'filesystem_read', 'filesystem_write'],
    systemPrompt: 'You are GIA in Task Planner mode. Break complex requests into numbered steps with clear dependencies and estimated effort. Present a plan, get confirmation, then execute step by step.',
  },
  {
    id: 'gia-reviewer',
    name: 'Code Reviewer',
    description: 'Thorough code review for bugs, security issues, and best practices.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['review', 'code-quality', 'bugs', 'security-review'],
    tools: ['terminal_run', 'filesystem_read'],
    systemPrompt: 'You are a thorough code reviewer. Check for: correctness, edge cases, security vulnerabilities, performance issues, readability, and test coverage. Give actionable feedback grouped by severity: critical, warning, suggestion.',
  },
  {
    id: 'gia-debugger',
    name: 'Debugger',
    description: 'Systematic debugging for any error, stack trace, or unexpected behavior.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['debug', 'error', 'troubleshoot', 'fix'],
    tools: ['terminal_run', 'filesystem_read', 'web_search'],
    systemPrompt: 'You are a systematic debugger. Reproduce the issue, read the error carefully, trace the root cause, propose a minimal fix, and verify it works. Always try to reproduce first.',
  },
  {
    id: 'gia-translator',
    name: 'Translator',
    description: 'Translate text between languages with cultural context.',
    author: 'GIA',
    version: '1.0.0',
    category: 'language',
    tags: ['translate', 'language', 'i18n', 'l10n'],
    tools: ['web_search'],
    systemPrompt: 'You are a translator. Translate accurately while preserving tone, formality, and context. Provide transliteration for non-Latin scripts. Note cultural nuances.',
  },
  {
    id: 'gia-summarizer',
    name: 'Summarizer',
    description: 'Summarize long documents, articles, and conversations into concise summaries.',
    author: 'GIA',
    version: '1.0.0',
    category: 'productivity',
    tags: ['summarize', 'concise', 'reading', 'compression'],
    tools: ['web_search', 'terminal_run'],
    systemPrompt: 'You are a summarizer. Extract the key points, main arguments, and important details. Keep summaries concise and accurate. Preserve important data, dates, names, and numbers.',
  },
  {
    id: 'gia-outline',
    name: 'Outliner',
    description: 'Create structured outlines and table of contents for documents and projects.',
    author: 'GIA',
    version: '1.0.0',
    category: 'writing',
    tags: ['outline', 'structure', 'organization', 'toc'],
    tools: ['filesystem_read', 'filesystem_write'],
    systemPrompt: 'You are an outliner. Create clear hierarchical outlines with numbered sections and subsections. Use parallel structure. Focus on logical flow and completeness.',
  },
  {
    id: 'gia-formatter',
    name: 'Formatter',
    description: 'Format code, text, JSON, YAML, CSV, and other structured content.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['format', 'code-style', 'clean', 'beautify'],
    tools: ['terminal_run'],
    systemPrompt: 'You are a formatter. Clean up code and text according to standard style guides. Fix indentation, spacing, and naming. Never change logic — only formatting.',
  },
  {
    id: 'gia-prompt',
    name: 'Prompt Engineer',
    description: 'Write and optimize prompts for AI models and LLMs.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['prompt', 'llm', 'ai', 'optimization'],
    tools: ['web_search'],
    systemPrompt: 'You are a prompt engineering specialist. Write clear, specific, well-structured prompts. Use examples, constraints, and output format specifications. Test prompts for ambiguity.',
  },
  {
    id: 'gia-changelog',
    name: 'Changelog Writer',
    description: 'Write clear changelogs and release notes from commit history or descriptions.',
    author: 'GIA',
    version: '1.0.0',
    category: 'writing',
    tags: ['changelog', 'release', 'notes', 'git'],
    tools: ['terminal_run', 'filesystem_read'],
    systemPrompt: 'You are a changelog writer. Write clear, categorized release notes from commit messages or descriptions. Use conventional commits format: feat, fix, docs, style, refactor, test, chore.',
  },
  {
    id: 'gia-readme',
    name: 'README Author',
    description: 'Write comprehensive README files with setup, usage, and contributing sections.',
    author: 'GIA',
    version: '1.0.0',
    category: 'writing',
    tags: ['readme', 'docs', 'setup', 'documentation'],
    tools: ['filesystem_read', 'filesystem_write'],
    systemPrompt: 'You are a README author. Write clear, comprehensive README files with: description, features, installation, usage, configuration, contributing, license, and badges. Use proper markdown formatting.',
  },
  {
    id: 'gia-test',
    name: 'Test Writer',
    description: 'Write unit tests, integration tests, and test suites for any codebase.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['test', 'unit-test', 'testing', 'qa'],
    tools: ['terminal_run', 'filesystem_read'],
    systemPrompt: 'You are a test writer. Write comprehensive tests following best practices: arrange-act-assert pattern, describe/it blocks, meaningful test names, edge cases, and error paths. Target 80%+ coverage.',
  },
  {
    id: 'gia-deploy',
    name: 'Deploy Guide',
    description: 'Write deployment guides and CI/CD configuration for any platform.',
    author: 'GIA',
    version: '1.0.0',
    category: 'devops',
    tags: ['deploy', 'ci-cd', 'docker', 'infrastructure'],
    tools: ['terminal_run', 'filesystem_read', 'filesystem_write'],
    systemPrompt: 'You are a deployment specialist. Write deployment guides, CI/CD configs, Dockerfiles, and infrastructure-as-code. Be platform-specific and include troubleshooting steps.',
  },
  {
    id: 'gia-api',
    name: 'API Designer',
    description: 'Design REST APIs, GraphQL schemas, and API documentation.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['api', 'rest', 'graphql', 'design', 'endpoints'],
    tools: ['filesystem_write'],
    systemPrompt: 'You are an API designer. Design clean REST APIs with proper HTTP verbs, status codes, pagination, filtering, and versioning. Write OpenAPI/Swagger docs and GraphQL schemas.',
  },
  {
    id: 'gia-database',
    name: 'Database Designer',
    description: 'Design database schemas, write migrations, and optimize queries.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['database', 'sql', 'schema', 'migration', 'query'],
    tools: ['terminal_run', 'filesystem_write'],
    systemPrompt: 'You are a database designer. Design normalized schemas, write migrations, and optimize queries. Support PostgreSQL, MySQL, SQLite, and MongoDB. Include indexes and constraints.',
  },
  {
    id: 'gia-sec-audit',
    name: 'Security Auditor',
    description: 'Audit code and systems for security vulnerabilities and compliance.',
    author: 'GIA',
    version: '1.0.0',
    category: 'security',
    tags: ['security', 'audit', 'vulnerability', 'compliance'],
    tools: ['terminal_run', 'filesystem_read', 'web_search'],
    systemPrompt: 'You are a security auditor. Check for OWASP Top 10 vulnerabilities: SQL injection, XSS, CSRF, auth flaws, secrets in code, dependency risks, misconfigurations. Provide clear remediation steps.',
  },
  {
    id: 'gia-perf',
    name: 'Performance Optimizer',
    description: 'Profile and optimize code for speed, memory, and scalability.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['performance', 'optimize', 'profile', 'speed', 'memory'],
    tools: ['terminal_run', 'filesystem_read'],
    systemPrompt: 'You are a performance optimizer. Profile code, identify bottlenecks, and suggest concrete optimizations. Focus on measurable improvements, not micro-optimizations unless they matter.',
  },
  {
    id: 'gia-type',
    name: 'TypeScript Expert',
    description: 'Expert TypeScript type design, generics, and utility types.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['typescript', 'types', 'generics', 'type-safety'],
    tools: ['terminal_run', 'filesystem_read'],
    systemPrompt: 'You are a TypeScript expert. Write precise types, generic utilities, and type-safe abstractions. Prefer strict mode, avoid any, and leverage the type system fully.',
  },
  {
    id: 'gia-react',
    name: 'React Specialist',
    description: 'Expert React development with hooks, performance, and patterns.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['react', 'hooks', 'components', 'frontend', 'ui'],
    tools: ['terminal_run', 'filesystem_read', 'filesystem_write'],
    systemPrompt: 'You are a React specialist. Use functional components with hooks. Optimize with memo, useMemo, useCallback. Follow React best practices: colocate state, avoid unnecessary re-renders, use proper keys.',
  },
  {
    id: 'gia-tailwind',
    name: 'Tailwind CSS Specialist',
    description: 'Expert Tailwind CSS utility-first styling and design systems.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['tailwind', 'css', 'styling', 'design', 'ui'],
    tools: ['filesystem_write'],
    systemPrompt: 'You are a Tailwind CSS specialist. Write utility-first classes following design systems. Use proper dark mode, responsive breakpoints, and accessibility (focus rings, aria labels).',
  },
  {
    id: 'gia-node',
    name: 'Node.js Specialist',
    description: 'Expert Node.js backend development with Express, Fastify, and APIs.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['node', 'express', 'backend', 'api', 'server'],
    tools: ['terminal_run', 'filesystem_read', 'filesystem_write'],
    systemPrompt: 'You are a Node.js specialist. Write clean Express/Fastify servers with proper error handling, middleware, validation, security headers, and structured logging.',
  },
  {
    id: 'gia-python',
    name: 'Python Specialist',
    description: 'Expert Python development with clean code and standard libraries.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['python', 'backend', 'scripting', 'data', 'automation'],
    tools: ['terminal_run', 'filesystem_read', 'filesystem_write'],
    systemPrompt: 'You are a Python specialist. Write clean, idiomatic Python with proper error handling, type hints, and standard library usage. Follow PEP 8 and use virtual environments.',
  },
  {
    id: 'gia-docker',
    name: 'Docker Specialist',
    description: 'Expert Docker containerization, multi-stage builds, and Docker Compose.',
    author: 'GIA',
    version: '1.0.0',
    category: 'devops',
    tags: ['docker', 'container', 'compose', 'devops'],
    tools: ['filesystem_read', 'filesystem_write'],
    systemPrompt: 'You are a Docker specialist. Write efficient multi-stage Dockerfiles, Docker Compose files, and .dockerignore. Follow security best practices: non-root user, minimal base images, layer caching.',
  },
  {
    id: 'gia-git',
    name: 'Git Helper',
    description: 'Git operations, rebase strategies, and commit message conventions.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['git', 'version-control', 'commits', 'branching'],
    tools: ['terminal_run'],
    systemPrompt: 'You are a git helper. Help with git operations: branching strategies, rebasing, cherry-picking, conflict resolution. Follow conventional commits. Never force push to shared branches.',
  },
  {
    id: 'gia-cli',
    name: 'CLI Tool Builder',
    description: 'Build command-line tools and dev utilities with Node.js or Python.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['cli', 'terminal', 'devtools', 'utility'],
    tools: ['terminal_run', 'filesystem_write'],
    systemPrompt: 'You are a CLI tool builder. Create interactive command-line tools with proper argument parsing (yargs/argparse), colored output, error handling, and subcommands.',
  },
  {
    id: 'gia-config',
    name: 'Config Manager',
    description: 'Manage and generate configs for build tools, linters, and CI pipelines.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['config', 'eslint', 'prettier', 'vite', 'webpack', 'ci'],
    tools: ['filesystem_read', 'filesystem_write'],
    systemPrompt: 'You are a config manager. Generate and explain configs for: Vite, Webpack, ESLint, Prettier, Jest, Vitest, TypeScript, GitHub Actions, and other tools. Always include comments explaining each option.',
  },
  {
    id: 'gia-migrate',
    name: 'Migration Helper',
    description: 'Plan and execute codebase migrations between frameworks, languages, or versions.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['migration', 'upgrade', 'codemod', 'refactor'],
    tools: ['terminal_run', 'filesystem_read', 'filesystem_write'],
    systemPrompt: 'You are a migration helper. Plan incremental migrations with clear steps. Never do big-bang rewrites. Provide codemod scripts where possible and test each phase.',
  },
  {
    id: 'gia-search',
    name: 'Search Engineer',
    description: 'Implement search functionality with indexing, ranking, and filtering.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['search', 'indexing', 'elasticsearch', 'fuzzy', 'ranking'],
    tools: ['terminal_run', 'filesystem_read'],
    systemPrompt: 'You are a search engineer. Design search systems with proper indexing, ranking algorithms, fuzzy matching, and filtering. Support both keyword and semantic search.',
  },
  {
    id: 'gia-auth',
    name: 'Auth Specialist',
    description: 'Implement authentication, authorization, and session management.',
    author: 'GIA',
    version: '1.0.0',
    category: 'security',
    tags: ['auth', 'security', 'jwt', 'oauth', 'session', 'rbac'],
    tools: ['terminal_run', 'filesystem_read', 'filesystem_write'],
    systemPrompt: 'You are an auth specialist. Implement secure authentication with JWT, OAuth, session management, and RBAC. Follow security best practices: hash passwords with bcrypt, use HTTPS, never store secrets in code.',
  },
  {
    id: 'gia-realtime',
    name: 'Realtime Engineer',
    description: 'Build real-time features with WebSockets, SSE, and event-driven architecture.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['realtime', 'websocket', 'sse', 'events', 'streaming'],
    tools: ['terminal_run', 'filesystem_read'],
    systemPrompt: 'You are a realtime engineer. Build WebSocket and SSE implementations with proper connection management, reconnection, and error handling. Use structured event protocols.',
  },
  {
    id: 'gia-data-viz',
    name: 'Data Visualization',
    description: 'Create charts, graphs, and dashboards with Recharts, D3, or vanilla SVG.',
    author: 'GIA',
    version: '1.0.0',
    category: 'engineering',
    tags: ['data-viz', 'charts', 'dashboard', 'svg', 'recharts'],
    tools: ['terminal_run', 'filesystem_read', 'filesystem_write'],
    systemPrompt: 'You are a data visualization specialist. Create clean, accessible charts using Recharts, SVG, or Canvas. Prefer semantic markup, proper colors, and responsive design.',
  },
];

// External registries to fetch skills from
const EXTERNAL_REGISTRIES = [
  {
    name: 'SkillsMP',
    // SkillsMP's real API (verified against https://skillsmp.com/docs/api) only
    // exposes GET /api/v1/skills/search, and `q` is a required parameter with
    // no wildcard support -- there is no bare "browse everything" endpoint.
    // The previous URL here (`/api/v1/skills?limit=50&sort=trending`) doesn't
    // exist on their API at all: wrong path, and `sort=trending` isn't a real
    // param (only `sortBy=stars|recent`). It was silently failing on every
    // load and swallowed by the catch below, so this registry contributed
    // zero results forever with no visible error.
    // Fixed by querying their real search endpoint with a handful of broad
    // terms (sorted by stars) and merging + deduping the results client-side,
    // which is the only way to approximate "browse popular skills" within
    // what the documented API actually supports.
    urls: [
      'automation',
      'coding',
      'writing',
      'research',
      'productivity',
    ].map(q => `https://skillsmp.com/api/v1/skills/search?q=${encodeURIComponent(q)}&sortBy=stars&limit=15`),
    source: 'skillsmp' as const,
    transform: async (data: unknown): Promise<RegistryEntry[]> => {
      const items = data as { skills?: Array<{ slug: string; name: string; description: string; author: string; version: string; category: string; tags: string[]; downloads: number; rating: number; content?: string }> };
      return (items.skills || []).map(s => ({
        id: `smp-${s.slug}`,
        name: s.name,
        description: s.description,
        author: s.author,
        version: s.version || '1.0.0',
        category: s.category || 'general',
        tags: s.tags || [],
        tools: ['web_search'],
        sourceUrl: `https://skillsmp.com/skills/${s.slug}`,
        systemPrompt: s.content || `You are a ${s.name} specialist. Follow the skill instructions.`,
      }));
    },
  },
  {
    // Real Claude skills from Anthropic's official skills repo
    name: 'Claude Skills (Anthropic)',
    url: 'https://api.github.com/repos/anthropics/skills/contents/skills',
    source: 'claudeskill' as const,
    transform: async (data: unknown): Promise<RegistryEntry[]> => {
      const items = data as Array<{ name: string; download_url: string; type: string }>;
      if (!Array.isArray(items)) return [];
      return items
        .filter(i => i.type === 'dir')
        .map(dir => {
          const slug = dir.name;
          const prettyName = slug
            .split('-')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          return {
            id: `claude-${slug}`,
            name: prettyName,
            description: `Official Claude skill: ${prettyName}. Install to load its full SKILL.md instructions into GIA.`,
            author: 'Anthropic',
            version: '1.0.0',
            category: ['writing', 'pdf', 'docx', 'brand', 'algorithmic', 'website', 'skill', 'canvas'].some(k => slug.includes(k)) ? 'content' : 'general',
            tags: ['claude', 'anthropic', slug],
            tools: ['terminal_run', 'filesystem_read', 'filesystem_write', 'web_search'],
            sourceUrl: dir.download_url.replace('/contents/skills', '/contents/skills/' + slug + '/SKILL.md'),
            systemPrompt: `You are a ${prettyName} specialist (Claude skill). Install the skill to load full instructions.`,
          };
        });
    },
  },
  {
    // davila7/claude-code-templates — 29.9k stars, 100+ agents, skills, MCPs, commands
    name: 'Davila7 Claude Templates',
    url: 'https://api.github.com/repos/davila7/claude-code-templates/contents',
    source: 'claudeskill' as const,
    transform: async (data: unknown): Promise<RegistryEntry[]> => {
      const root = data as Array<{ name: string; download_url: string; type: string; url: string }>;
      if (!Array.isArray(root)) return [];

      // Find .claude-plugin/skills directory URL
      const pluginEntry = root.find(e => e.name === '.claude-plugin');
      if (!pluginEntry) return [];

      // Fetch .claude-plugin contents
      const pluginRes = await fetch(pluginEntry.url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (!pluginRes?.ok) return [];
      const pluginContent = await pluginRes.json() as Array<{ name: string; type: string; url: string }>;
      const skillsDir = pluginContent.find(e => e.name === 'skills');
      if (!skillsDir) return [];

      // Fetch skills directory contents
      const skillsRes = await fetch(skillsDir.url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (!skillsRes?.ok) return [];
      const skills = await skillsRes.json() as Array<{ name: string; type: string; url: string }>;

      const results: RegistryEntry[] = [];
      for (const skill of skills.filter(s => s.type === 'dir')) {
        try {
          const skillRes = await fetch(skill.url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
          if (!skillRes?.ok) continue;
          const skillFiles = await skillRes.json() as Array<{ name: string; download_url: string; type: string }>;

          const skillJson = skillFiles.find(f => f.name === 'skill.json');

          let skillData: { name?: string; description?: string; tools?: string[] } = {};
          let systemPrompt = `You are a ${skill.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} specialist.`;

          if (skillJson) {
            const jsonRes = await fetch(skillJson.download_url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
            if (jsonRes?.ok) {
              try {
                const json = await jsonRes.json();
                skillData = {
                  name: json.name,
                  description: json.description,
                  tools: json.tools,
                };
                systemPrompt = json.systemPrompt || systemPrompt;
              } catch { /* ignore invalid JSON */ }
            }
          }

          // Also fetch SKILL.md for additional instructions
          const skillMd = skillFiles.find(f => f.name === 'SKILL.md');
          if (skillMd) {
            const mdRes = await fetch(skillMd.download_url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
            if (mdRes?.ok) {
              try {
                const mdContent = await mdRes.text();
                systemPrompt += '\n\nAdditional instructions from SKILL.md:\n' + mdContent.slice(0, 3000);
              } catch { /* ignore */ }
            }
          }

          results.push({
            id: `davila7-${skill.name}`,
            name: skillData.name || skill.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: skillData.description || `Claude Code template: ${skill.name}`,
            author: 'davila7',
            version: '1.0.0',
            category: 'template',
            tags: ['claude-code', 'davila7', skill.name],
            tools: skillData.tools || ['terminal_run', 'filesystem_read', 'filesystem_write', 'web_search'],
            sourceUrl: `https://github.com/davila7/claude-code-templates/tree/main/.claude-plugin/skills/${skill.name}`,
            systemPrompt,
          });
        } catch { /* skip failed skills */ }
      }
      return results;
    },
  },
];

class SkillsMarketplace {
  private cache: Map<string, MarketplaceSkill> = new Map();
  private fetchPromise: Promise<MarketplaceSkill[]> | null = null;
  private lastFetch = 0;
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.loadInstalledFromStorage();
  }

  private loadInstalledFromStorage() {
    try {
      const raw = localStorage.getItem('gia-marketplace-installed');
      if (raw) {
        const installed: MarketplaceSkill[] = JSON.parse(raw);
        for (const skill of installed) {
          this.cache.set(skill.id, skill);
        }
      }
    } catch { /* ignore */ }
  }

  private saveInstalledToStorage() {
    try {
      const installed = Array.from(this.cache.values()).filter(s => s.installed);
      localStorage.setItem('gia-marketplace-installed', JSON.stringify(installed));
    } catch { /* ignore */ }
  }

  async fetchSkills(forceRefresh = false): Promise<MarketplaceSkill[]> {
    const now = Date.now();
    if (!forceRefresh && this.fetchPromise && now - this.lastFetch < this.CACHE_TTL) {
      return this.fetchPromise;
    }

    this.lastFetch = now;
    this.fetchPromise = this._fetchSkills();
    return this.fetchPromise;
  }

  private async _fetchSkills(): Promise<MarketplaceSkill[]> {
    const results: MarketplaceSkill[] = [];

    // 1. Add built-in GIA skills
    for (const entry of GIA_BUILTIN_REGISTRY) {
      const existing = this.cache.get(entry.id);
      results.push({
        ...entry,
        sourceUrl: entry.sourceUrl || '',
        source: 'gia-registry',
        installs: 0,
        rating: 5,
        installed: existing?.installed ?? false,
        installedAt: existing?.installedAt,
        enabled: existing?.enabled ?? true,
        customizable: true,
        skillMd: '',
      });
    }

    // 2. Fetch from external registries (parallel, best-effort)
    const externalResults = await Promise.allSettled(
      EXTERNAL_REGISTRIES.map(async (reg) => {
        // Registries may expose either a single `url` or multiple `urls`
        // (SkillsMP needs several queries since its API has no bare browse
        // endpoint). Fetch whichever set applies, dedupe by id.
        const urls = 'urls' in reg && reg.urls ? reg.urls : [(reg as { url: string }).url];
        const seen = new Map<string, RegistryEntry>();
        for (const url of urls) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) continue;
            const data = await res.json();
            const entries = await reg.transform(data);
            for (const entry of entries) seen.set(entry.id, entry);
          } catch { /* best-effort per URL; other queries in this registry may still succeed */ }
        }
        return Array.from(seen.values());
      })
    );

    for (const result of externalResults) {
      if (result.status === 'fulfilled') {
        for (const entry of result.value) {
          const existing = this.cache.get(entry.id);
          results.push({
            ...entry,
            sourceUrl: entry.sourceUrl || '',
            source: 'skillsmp',
            installs: 0,
            rating: 4,
            installed: existing?.installed ?? false,
            installedAt: existing?.installedAt,
            enabled: existing?.enabled ?? true,
            customizable: true,
            skillMd: '',
          });
        }
      }
    }

    // 3. Add any previously installed skills not in registries
    for (const [id, skill] of this.cache) {
      if (!results.find(r => r.id === id)) {
        results.push(skill);
      }
    }

    // Update cache
    for (const skill of results) {
      this.cache.set(skill.id, skill);
    }

    return results;
  }

  async installSkill(skillId: string): Promise<{ success: boolean; error?: string }> {
    const skill = this.cache.get(skillId);
    if (!skill) return { success: false, error: 'Skill not found' };
    if (skill.installed) return { success: false, error: 'Already installed' };

    // Fetch SKILL.md if from external source
    let skillMd = skill.skillMd;
    if (skill.sourceUrl && !skillMd) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(skill.sourceUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) skillMd = await res.text();
      } catch { /* use what we have */ }
    }

    // Install into store
    const { useGiaStore } = await import('../store/useGiaStore');
    const store = useGiaStore.getState();

    const storeSkill: import('../store/useGiaStore').Skill = {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      systemPrompt: skill.skillMd || skill.systemPrompt,
      tools: skill.tools,
      category: skill.category === 'engineering' || skill.category === 'security' ? 'dev' : skill.category === 'content' || skill.category === 'creative' ? 'creative' : 'user',
    };

    store.addSkill(storeSkill);

    // Mark as installed
    skill.installed = true;
    skill.installedAt = Date.now();
    skill.skillMd = skillMd;
    this.cache.set(skillId, skill);
    this.saveInstalledToStorage();

    logger.log(`[SkillsMarketplace] Installed: ${skill.name}`);
    return { success: true };
  }

  async uninstallSkill(skillId: string): Promise<{ success: boolean; error?: string }> {
    const skill = this.cache.get(skillId);
    if (!skill) return { success: false, error: 'Skill not found' };

    const { useGiaStore } = await import('../store/useGiaStore');
    useGiaStore.getState().removeSkill(skillId);

    skill.installed = false;
    skill.installedAt = undefined;
    this.cache.set(skillId, skill);
    this.saveInstalledToStorage();

    return { success: true };
  }

  toggleSkill(skillId: string): boolean {
    const skill = this.cache.get(skillId);
    if (!skill) return false;
    skill.enabled = !skill.enabled;
    this.cache.set(skillId, skill);
    this.saveInstalledToStorage();
    return skill.enabled;
  }

  getInstalledSkills(): MarketplaceSkill[] {
    return Array.from(this.cache.values()).filter(s => s.installed);
  }

  getSkill(skillId: string): MarketplaceSkill | undefined {
    return this.cache.get(skillId);
  }

  searchSkills(query: string): MarketplaceSkill[] {
    const q = query.toLowerCase();
    return Array.from(this.cache.values()).filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.includes(q)) ||
      s.category.includes(q)
    );
  }

  getCategories(): string[] {
    const cats = new Set<string>();
    for (const skill of this.cache.values()) {
      cats.add(skill.category);
    }
    return Array.from(cats).sort();
  }

  // Custom skill creation — GIA generates it
  async createCustomSkill(params: {
    name: string;
    description: string;
    category: string;
    systemPrompt: string;
    tools: string[];
  }): Promise<MarketplaceSkill> {
    const id = `custom-${params.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const skill: MarketplaceSkill = {
      id,
      name: params.name,
      description: params.description,
      author: 'You',
      version: '1.0.0',
      category: params.category,
      tags: [params.category, 'custom'],
      installs: 0,
      rating: 5,
      source: 'custom',
      sourceUrl: '',
      skillMd: '',
      tools: params.tools,
      systemPrompt: params.systemPrompt,
      installed: true,
      installedAt: Date.now(),
      enabled: true,
      customizable: true,
    };

    // Add to store
    const { useGiaStore } = await import('../store/useGiaStore');
    useGiaStore.getState().addSkill({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      systemPrompt: skill.systemPrompt,
      tools: skill.tools,
      category: 'user',
    });

    this.cache.set(id, skill);
    this.saveInstalledToStorage();
    return skill;
  }
}

export default new SkillsMarketplace();
