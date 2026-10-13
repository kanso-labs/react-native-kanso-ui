# AGENTS.md

Guidance for coding agents working in this repository.

## What this is

react-native-kanso-ui is [kanso-ui](https://github.com/kanso-labs/kanso-ui) for
React Native: the same component names, props, token roles and Material Design
readings, drawn with React Native's core components. React Aria and StyleX,
which the web library is built on, do not run on native, so the components here
are written against `View`, `Text`, `Pressable` and their kin, with `StyleSheet`
styles built from the theme.

**The theming contract is the web library's, unchanged.** A theme is a set of
`--kui-*` custom properties with values in CSS syntax, exactly as kanso-ui's
`tokens.css` declares them, so one theme object serves both libraries.
`src/theme/resolve.ts` is the one place those values are read: it resolves
`var()` references the way a browser does, turns `12px` into `12`, `100ms` into
`100` and a `cubic-bezier()` into its four control points, and groups the
results under the keys the web library's StyleX tokens use, so
`--kui-color-primary` is `colors.primary` on both platforms. A value native
cannot evaluate, such as `calc()` or `color-mix()`, keeps the property at its
default and is listed by name among the resolver's problems rather than dropped.

**No token value is written by hand here.** The
[Kanso UI design system artifact](https://claude.ai/artifact/TJSpYMBeBEMx1agnDVuZdv)
is the design system's source of truth, and kanso-ui's
`src/tokens/design.tokens.json` is the copy every package builds from: a daily
routine in kanso-ui opens a pull request carrying what was edited in the
artifact, and kanso-ui publishes the file as `@kanso-labs/kanso-ui/tokens.json`.
That export is the only place this repository takes a token value from. A token
change therefore starts in the artifact or in a kanso-ui pull request, never
here, and reaches this repository as the Renovate bump of `@kanso-labs/kanso-ui`
that follows the release carrying it. `.design-sync/artifact/README.md` in
kanso-ui describes the sync.

**`src/tokens/defaults.ts` is generated and not committed.**
`scripts/build-tokens.mjs` writes it from the pinned package's `tokens.json`
through Style Dictionary: every `--kui-*` property at its light and its dark
value, each exactly as kanso-ui's `tokens.css` writes it, the `KuiTheme` type,
and the window size class breakpoints. `build`, `lint` and `test` run
`npm run tokens:build` first, so a Renovate bump of `@kanso-labs/kanso-ui` is
the whole of a token change: CI builds and tests the new values with nothing to
regenerate by hand, and the bump can merge itself. A committed copy would go
stale with every bump and fail the tests that compare it with the new
`tokens.css`. `src/tokens/defaults.test.ts` is that comparison, and it also pins
that the resolver reads every default and that `KuiTheme` is the web library's
type.

## Commands

| Task     | Command                 | Notes                                                          |
| -------- | ----------------------- | -------------------------------------------------------------- |
| Test     | `npm test`              | Jest, through React Native's own preset                        |
| Coverage | `npm run test:coverage` | The same suite with coverage, written to `coverage/`           |
| Lint     | `npm run lint`          | oxlint, then ESLint, then oxfmt formatting check               |
| Build    | `npm run build`         | Type-checks (`tsc -b`) then builds ESM into `dist/`            |
| Format   | `npm run format`        | oxfmt; `npm run format:check` is the check `lint` already runs |
| Verify   | `npm run package:check` | publint, then attw; reads `dist/`, so build first              |
| Tokens   | `npm run tokens:build`  | Writes `src/tokens/defaults.ts`; build, lint and test run it   |

**Install with the Node version in `.tool-versions`.** CI resolves it from that
file, and an older npm rewrites `package-lock.json` in a way no check here can
see. If `node --version` disagrees, prefix the command so it reads the pin
rather than restating it:

```bash
mise exec node@"$(awk '/^nodejs/{print $2}' .tool-versions)" -- npm install
```

## Conventions

Shared with the other `kanso-labs` repositories. The canonical text is
[`CONVENTIONS.md`](https://github.com/kanso-labs/.github/blob/main/CONVENTIONS.md)
in `kanso-labs/.github`; this is a copy, kept in step by hand. Change that file
first, then every copy.

- **Keys in JSON and YAML are ordered by name.** Files whose order carries
  meaning are exempt: workflows, where step order is execution order;
  changelogs, which are chronological; and `package.json`, where the npm
  ecosystem expects `name` and `version` first.
- **A workflow's filename is the kebab-case of its `name:` field.** Reusable
  workflows, meaning those triggered only by `workflow_call`, take a leading
  underscore.
- **Job names and step names are imperative verb phrases.** Job ids, step ids,
  and matrix keys are exempt.
- **Actions are pinned to exact release tags**, `actions/checkout@v7.0.1`, never
  `@main` and never a tag the publisher moves — `@v7` and `@v7.0` both move.
  Renovate opens the bump pull requests, and it has nothing to open when the pin
  never changes: `frenck/action-app-linter@v2.21` sat still through a repository
  rename and a release that fixed something a consumer was working around,
  because the tag it named was moved onto both.
- **Dependency versions are pinned exactly.** Every `dependencies`,
  `devDependencies`, and `optionalDependencies` entry is a bare version,
  `1.2.3`, never `^1.2.3`, `~1.2.3`, `>=1.2.3`, `*`, `1.x`, or an `||` union.
  Renovate opens those bumps too. `peerDependencies` are the deliberate
  exception: they state what the consumer's own installed copy must satisfy, so
  ranges are correct there and stay.
- **`.tool-versions` pins a fully-specified version on every line**,
  `nodejs <major>.<minor>.<patch>`, never `nodejs 24` or `nodejs lts`.

In TypeScript the ordering rule is enforced rather than trusted:
`eslint-plugin-perfectionist` runs at `recommended-natural`, so object keys,
imports, union members and the declarations in a module are sorted by the
linter. `npm run lint -- --fix` puts them in order.

The formatter is not shared: **oxfmt formats this repository**, not Prettier, so
the command is `npm run format` and the check runs inside `npm run lint`.
`CHANGELOG.md` and `LICENSE.md` are exempt in `.oxfmtrc.json`: release-please
writes the first in a style oxfmt disagrees with, and the second is owned
elsewhere.

Specific to this repository:

- **Every component follows its Material Design spec page**, at
  `https://m3.material.io/components/<component>/specs`, as kanso-ui's do: the
  container sizes, corner shapes, paddings, icon sizes, type roles and colour
  roles the page gives, in every state it lists. Sizes stay in dp, which is what
  the spec's pixels already are. A deliberate departure is written down in the
  component's comment with the reason, so the next reader can tell a decision
  from a mistake.
- **Props match the web library's.** A component keeps kanso-ui's name, prop
  names and prop values, and differs only where the platform forces it: `style`
  takes a React Native style where web takes `className`.
- **The design system is called Material Design**, in comments, tests, docs and
  commit messages alike, never a version or an edition name. The spec site's URL
  is the one place a version appears.
- **Comments describe what the library has.** A comment explains what the code
  in front of it does and why, never a component or behaviour the library lacks.
  What is not built yet is the plan's business, recorded in the project's
  issues.
- **A token is read from the theme, never written as a literal.** The groups and
  keys are the web library's, so a value that matches the spec is a token, and a
  literal colour or length in a style is the same smell it is on web.
- **Sample copy stays domain-neutral**, as in kanso-ui: placeholder text that
  names the slot it fills, such as `Label`, `Headline` or `Supporting line`, and
  placeholder names such as `Ada Lovelace`.
- Staged `.cjs`, `.js`, `.mjs`, `.ts` and `.tsx` files are linted (oxlint, then
  ESLint) and formatted (oxfmt) on commit, through husky and lint-staged
  (`.lintstagedrc.json`). Staged `.json`, `.md`, `.yaml` and `.yml` files are
  formatted wherever they live. That entry passes
  `--no-error-on-unmatched-pattern` because oxfmt exits non-zero when every path
  handed to it is one of its own ignores, which would reject a commit staging
  `CHANGELOG.md` alone; keep `.oxfmtrc.json` the one list of ignores rather than
  repeating them in the glob.

## Testing

Jest runs every `src/**/*.test.{ts,tsx}`, beside the module it tests, through
`@react-native/jest-preset`, which mocks the native modules and runs a test in
the environment React Native's own tests use. Tests import `describe`, `it` and
`expect` from `@jest/globals` rather than reading them as globals, so a file
says where they come from. They type-check under `tsconfig.test.json`, which
gives them Node's types, while the library's own `tsconfig.lib.json` leaves them
out, since Hermes has none of Node's modules.

Components are tested with Testing Library for React Native. From version 14
`render` is asynchronous, so a test awaits it before querying.

**Reanimated runs in the suite on its JavaScript implementation.**
`jest.setup.ts` swaps worklets for the mock its testing guide recommends,
`babel.config.cjs` runs the worklets plugin as an app's Babel does, and
`jest.config.js` has Babel transform both packages, since both ship ES modules.
Read an animated style with Reanimated's `getAnimatedStyle`, under fake timers:
the style follows a shared value on the next frame, which
`jest.advanceTimersByTime(0)` runs.

**The suite runs what the React Compiler emits**, through `babel.config.cjs`,
and the published package is compiled by the same plugin in `tsdown.config.ts`.
The two are separate on purpose: tsdown's Babel plugin does not read Babel's
configuration files, so a change to the compiler's options is made in both. Both
set `panicThreshold: 'all_errors'`, because the compiler otherwise skips a
function it cannot compile and says nothing.

**Prove a new assertion can fail before trusting it.** Break the code it pins,
watch the test go red, and put the code back. `[].every()` is `true`, so a check
built on an empty list reports a state that never happened.

## Workflows and checks

`Build`, `Lint` and `Test` run on every pull request and on pushes to `main`,
all on [`kanso-labs/actions`](https://github.com/kanso-labs/actions) pinned by
exact tag. `Lint` runs actionlint before the install and checks the pull request
title with commitlint after it; both are steps of that job rather than jobs of
their own.

**A job name becomes a check name.** A ruleset requiring checks matches them by
exact string, so renaming a job means renaming it in the ruleset in the same
change. The `pull_request` trigger is deliberately unscoped: adding
`branches: [main]` would leave a pull request against any other base without the
checks a ruleset waits on, which reads as a hang rather than a failure.

**Releases are cut by release-please**, once a day at 09:00 UTC, from
`release-please.yaml`. It publishes through npm's trusted publishing, so this
repository holds no npm token. A trusted publisher is registered on the
package's npm page, which exists only once a first version has been published,
so that version is published by hand.

**Dependencies come from Renovate**, through the org-wide runner in
[`kanso-labs/renovate`](https://github.com/kanso-labs/renovate), and its commits
are typed `deps:` so an upgrade cuts a release of its own. Dependabot raises
security updates only, titled and labelled the same way through
`.github/dependabot.yaml`, and `dependabot-auto-merge.yaml` merges its minor and
patch ones. `.github/renovate.json` holds three version ceilings, each with the
reason beside it and the condition for lifting it: Babel below 8, Jest below 30
and TypeScript below 7.

## Commits and pull requests

Pull requests are squash-merged, with the pull request title as the commit
subject and an empty body. That title becomes the only commit on `main`, and is
what release-please reads to pick the next version and write the changelog line,
so it is the one that has to be right: a Conventional Commit, with `!` before
the colon for a breaking change. `.commitlintrc.json` admits `deps` beside the
standard types and turns commitlint's default ignores off, so a title GitHub's
Revert button writes has to be retitled `revert: …` before it merges.

Write branch commits conventionally anyway. They are what a reviewer reads while
the pull request is open.

## Working the plan

The [React Native project](https://github.com/orgs/kanso-labs/projects/8) holds
the plan: one issue per pull request, each titled with the Conventional Commit
it will merge as. Each issue carries a `kind:` and an `area:` label and the
native Priority and Effort fields, and names what it depends on. A pull request
closes its issue with `Closes #N` and takes the issue's two labels.

Items are worked in priority order, oldest first within a priority. Each item
branches from `main` unless its "Depends on" names a pull request that has not
merged yet.

## Traps

**`npm run lint` does not type-check.** It passes on code that `tsc -b` rejects,
so run `npm run build` before pushing as well.

**Jest is held at 29.** `@react-native/jest-preset` depends on `babel-jest` and
`jest-environment-node` at `^29.7.0`, so Jest 30 would run the preset's
environment from the major before it. The Renovate rule holding it says when to
lift it.
