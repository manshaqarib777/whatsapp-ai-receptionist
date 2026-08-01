/**
 * Conventional Commits, enforced at commit time.
 * Format: type(scope): subject   — see .claude/DEVELOPMENT_WORKFLOW.md
 */
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'docs',
        'test',
        'chore',
        'perf',
        'build',
        'ci',
        'style',
        'revert',
      ],
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [0],
  },
};

export default config;
