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
is the design system's source of truth, and
[`@kanso-labs/kanso-ui-core`](https://github.com/kanso-labs/kanso-ui-core) holds
the copy of the tokens both libraries build from. That package is the only place
this repository takes a token value from, so a token change starts in the
artifact or in a kanso-ui-core pull request, never here, and reaches this
repository as the Renovate bump of `@kanso-labs/kanso-ui-core` that follows the
release carrying it.

**`src/tokens/defaults.ts` re-exports the package**: `light` and `dark`, every
`--kui-*` property at its value in each scheme exactly as the package's
`tokens.css` writes it, the `KuiTheme` type, and the window size class
`breakpoints`. The package is a pinned devDependency, so tsdown bundles those
modules into `dist/kanso-ui-core/` and an app never installs it;
`scripts/check-package.mjs`, the last step of `npm run package:check`, fails a
build in which anything under `dist` still imports it. Jest transforms the
package, since it ships ES modules, and the example app lists it, since Metro
resolves from the app's own `node_modules`. `src/tokens/defaults.test.ts`
compares the defaults with the package's `tokens.css` and `tokens.json`, and
pins that the resolver reads every one of them.

## Commands

| Task      | Command                  | Notes                                                          |
| --------- | ------------------------ | -------------------------------------------------------------- |
| Test      | `npm test`               | Jest, through React Native's own preset                        |
| Coverage  | `npm run test:coverage`  | Jest with coverage and JUnit results, which `Test` uploads     |
| Stories   | `npm run test:storybook` | Every story in Chromium through Vitest, failing on a11y        |
| Storybook | `npm run storybook`      | The web Storybook at http://localhost:6006                     |
| Lint      | `npm run lint`           | oxlint, then ESLint, then oxfmt formatting check               |
| Build     | `npm run build`          | Type-checks (`tsc -b`) then builds ESM into `dist/`            |
| Format    | `npm run format`         | oxfmt; `npm run format:check` is the check `lint` already runs |
| Verify    | `npm run package:check`  | publint, attw, then a check for kanso-ui-core in `dist/`       |

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
and the published package is compiled by the same plugin in `tsdown.config.ts`,
and the web Storybook by the same plugin in `.storybook/main.ts`. The three are
separate on purpose: neither tsdown's Babel plugin nor Vite's React plugin reads
Babel's configuration files, so a change to the compiler's options is made in
all three. Each sets `panicThreshold: 'all_errors'`, because the compiler
otherwise skips a function it cannot compile and says nothing. In
`babel.config.cjs` it sits in an override excluding `node_modules`, since Jest
transforms Storybook's own ESM-only packages through that file too.

**Prove a new assertion can fail before trusting it.** Break the code it pins,
watch the test go red, and put the code back. `[].every()` is `true`, so a check
built on an empty list reports a state that never happened.

### Coverage

`Test` runs `npm run test:coverage`, which is Jest with the Cobertura reporter
`jest.config.js` names, over the library's own source: stories, tests, the
generated tokens and the Theming pages are left out. The stories in Chromium run
uninstrumented, so the number is Jest's alone.

**That report goes to two places from the same `Test` job**, as in kanso-ui.
`actions/upload-code-coverage` reports it on the pull request under the
`code-coverage/jest` label, and that is the report the Default ruleset's
coverage rule reads, under "Workflows and checks" below.
`codecov/codecov-action` uploads the same Cobertura file to Codecov, which keeps
the history the trend lines and the README's badge are drawn from, and gates
nothing: its `fail_ci_if_error` is left at the default of `false`, so a failed
upload does not fail `Test`, and `.github/codecov.yml` marks every Codecov
status informational. That file is `.yml` rather than the `.yaml` everything
else here uses because Codecov recognises `codecov.yml` and `.codecov.yml`
alone.

**A third upload is test results, not coverage.** Jest writes JUnit XML to
`.jest/` through `jest-junit`, Vitest writes its own to `.vitest/`, and a second
`codecov/codecov-action` step with `report_type: test_results` sends both, for
Codecov to say which tests failed and which are flaky. It carries
`if: ${{ !cancelled() }}`, which makes it the one step that runs when a suite is
red, the only time it has anything to say.

Every Codecov upload wants `CODECOV_TOKEN`, an organisation secret. Without it
they fall back to a tokenless upload, which this repository being public makes
possible but rate-limited, so a report lands intermittently rather than not at
all, which reads as a flaky uploader rather than as a missing secret.

## Storybook

**Two Storybooks read the same story files**, every `src/**/*.stories.tsx`. The
web one, in `.storybook/`, renders them through React Native Web on Vite; it is
the published Storybook and the one the a11y checks read. The on-device one, in
`example/`, renders them in Expo Go on iOS and Android. The web rendering is a
stand-in: it catches token, layout and contrast drift, and says nothing about
how a platform draws text or shadows, which only the device Storybook shows.

**A story file is bundled by Metro as well as by Vite**, so it imports React
Native, the library and Storybook's types, and nothing else at runtime. A play
function reads a DOM the device has none of, so behaviour belongs in a
`*.test.tsx` instead.

The web Storybook's toolbar sets the `theme` global, which the canvas in
`.storybook/components/Canvas.tsx` hands to a `ThemeScope`: light or dark as its
scheme, and one of the demo schemes below as its `theme`. It defaults to light
rather than following the machine, and `&globals=theme:dark` on a story's URL
opens it dark. The device has no toolbar, so its canvas pins the scheme the
device's appearance asks for, unless the story pins a theme of its own.

**Every story is checked twice.** `src/stories.test.tsx` renders each one in
`npm test`, in both schemes, or in the one it pins, through Storybook's portable
stories and React Native's own host components, so a story that throws fails the
suite; it finds the files on disk, so a new one needs no entry.
`npm run test:storybook` runs each in Chromium through
`@storybook/addon-vitest`, where addon-a11y's `test: 'error'` fails a story on a
contrast or labelling violation in what React Native Web draws. `Test` runs
both.

**That run is in Vite's `development` mode, not Vitest's `test`**, through
`--mode development` in the script. React Native Web's Vite plugin sets
`__DEV__` from the mode, so under `test` every check a library makes only in
development is off, and a story that throws on one of them in the Storybook
passes the run. Run it through the npm script rather than a bare
`npx vitest run`, which drops the flag.

Jest reaches Storybook's packages, which ship ESM alone, through
`transformIgnorePatterns` in `jest.config.js`; take them out and the story test
fails to parse before it runs.

### The Theming pages

**The toolbar offers more than light and dark.** The other entries are the seven
demo schemes `src/theming/themes.ts` re-exports from
`@kanso-labs/kanso-ui-core`, which the `Theming` section is built from and which
the canvas applies to any story, so a component's own stories can be read in
one. They are the seven kanso-ui's Storybook renders, each the `--kui-*` map a
consumer would hand either library's `ThemeScope`, so a scheme changes in
kanso-ui-core and reaches both showcases through the Renovate bump. They are
Storybook material rather than library API: nothing under `src/index.ts` reaches
them, and coverage leaves them out.

- **A scheme states every colour.** The scope fills a property a map leaves out
  from the library's defaults in the scheme around it, so a colour left out
  takes its light or dark value from the device. No other group differs between
  the schemes, so a partial map over the others reads the same everywhere.
  `src/theming/themes.test.ts` holds each scheme to that, to properties the
  library declares, and to values the resolver can read.
- **Every pair a component renders clears WCAG AA**, the bar the library's own
  tokens hold to, and `npm run test:storybook` fails a scheme's page otherwise.
  `Theming/Dark` renders the page in the library's own dark scheme for the same
  check. It is hidden from the sidebar with `!dev`, since every other story
  renders in the light scheme the toolbar opens on, and without it nothing
  checks a dark pair.
- **Each scheme is a story file of its own**, titled `Theming/<Name>`, holding
  one story named after the entry: Storybook folds a component whose single
  story has its name into one sidebar leaf. Each pins its scheme with `globals`,
  which beats the toolbar, so the page renders the same whatever is asked of it.
- **A new component goes into `src/theming/showcase.tsx`**, the page every
  scheme renders, as a `Section` in its alphabetical place with the sentence
  under its headline that kanso-ui's showcase gives it. That page is the only
  one drawing the library under a scheme that is not its own, which is the only
  place a literal colour, corner or spacing step differs from the token it
  should have been. `src/theming/showcase.test.tsx` compares its sections with
  the directories under `src/components` and fails on one that is missing.

### The example app

`example/` is an Expo app of its own, with its own `package.json` and lockfile.
ESLint and the format check cover its files, but nothing in the root installs
it, and CI neither bundles it nor type-checks it; `npm run typecheck` there does
the second. **oxlint leaves the app out**, in `.oxlintrc.json`: its type-aware
rules read the app's `tsconfig.json`, which extends Expo's from the app's own
`node_modules`, so without that install the tsconfig is invalid and every
`require` in `metro.config.js` reads as `any`, which fails `Lint` on a checkout
that never installed the app, CI's among them. Its dependencies are the versions
its Expo SDK bundles, so `npx expo install --check` there says whether one has
drifted, and an SDK upgrade is `npx expo install expo@<version> --fix` rather
than a bump at a time.

Metro watches `../src` and resolves everything from the app's own
`node_modules`, so the bundle carries one React. That also means a runtime
dependency the library takes is one the app has to list too, at the same
version, or Metro cannot resolve the import that needs it; CI never bundles the
app, so only `npm run export` there says so. `tsconfig.json` maps the React and
React Native types the same way, since two copies of a type never match. Those
`paths` point at type declarations, so `experiments.tsconfigPaths` in `app.json`
is off: Expo would otherwise hand them to Metro, and `react` would resolve to
`@types/react`. `npm run export` in `example/` bundles the app for iOS and
Android without a device, which is the quickest check that a story still
resolves under Metro. `app.json` names those two platforms: Expo would otherwise
bundle for the web as well, which the root's Storybook does instead, and fail on
the React Native Web the app does not install.

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

**`Deploy Storybook` publishes the web Storybook to GitHub Pages**, on each
published release, and by hand through `workflow_dispatch` run from the
release's tag, since a dispatch builds the ref it is given. It posts no pull
request check, so no ruleset names it. It starts on a release only because
release-please publishes with an application token: a release published by
`GITHUB_TOKEN` starts no workflow at all.

**It needs two settings no file here holds.** Settings → Pages → Source has to
be "GitHub Actions". And the `github-pages` environment, under Settings →
Environments, has to admit the release tags through a `v*` tag rule: Pages
creates that environment admitting the default branch alone, and a run a release
starts runs on its tag. v0.1.0's deploy was refused before it started, with _Tag
"v0.1.0" is not allowed to deploy to github-pages due to environment protection
rules_, while the build job beside it passed.

**`Test` reports the suite's coverage on the pull request**, through
`actions/upload-code-coverage`, from the Cobertura file `npm run test:coverage`
writes. The Default ruleset's coverage rule reads that report, so a `Test` that
stops uploading it leaves every pull request waiting. The upload needs the
`code-quality: write` scope, which the pinned actionlint does not know yet;
`.github/actionlint.yaml` suppresses that one message for `test.yaml` alone.

**`Build` also uploads the bundle to Codecov**, through `@codecov/rollup-plugin`
in `tsdown.config.ts`, which `CODECOV_TOKEN` switches on: unset locally and
empty for a fork, so neither writes a stats file nor uploads anything. **A
failed upload does not fail the build**: an invalid token logs
`Failed to get pre-signed URL` and lets `Run build` pass, so read the job log
rather than the check mark. The bundle carries the declaration files beside the
JavaScript, which is why its status in `.github/codecov.yml` is informational.

**Releases are cut by release-please**, once a day at 09:00 UTC, from
`release-please.yaml`. It publishes through npm's trusted publishing, so this
repository holds no npm token, and then publishes the same tarball to GitHub
Packages with `GITHUB_TOKEN`, only once npm has taken it. A trusted publisher is
registered on the package's npm page, which exists only once a first version has
been published, so that version is published by hand: v0.1.0's run failed
`Publish to npm` with npm's 404 for a package it had never seen, and skipped
GitHub Packages with it.

**The first release is 0.1.0, and `initial-version` is what makes it so.** With
no release tagged yet, release-please has no version to bump, and starts at
1.0.0 whatever `bump-minor-pre-major` says; the manifest's `0.0.0` is not read
as a release. The key is read only while no release exists, so it changes
nothing once 0.1.0 is tagged.

**Dependencies come from Renovate**, through the org-wide runner in
[`kanso-labs/renovate`](https://github.com/kanso-labs/renovate), and its commits
are typed `deps:` so an upgrade cuts a release of its own. A repository is
managed by being listed in that runner's `config.js`, not by an onboarding pull
request, and `.github/renovate.json` here is merged over it.
`renovate-command.yaml` answers `@renovate rebase` on one of its pull requests;
only the copy on `main` runs, since `issue_comment` is a repository-level event.
Dependabot is not used, as in kanso-ui: do not add a `.github/dependabot.yaml`
back, or the two will open competing pull requests for the same upgrades.
`.github/renovate.json` holds three version ceilings, each with the reason
beside it and the condition for lifting it: Babel below 8, Jest below 30 and
TypeScript below 7.

## Commits and pull requests

Pull requests are squash-merged, with the pull request title as the commit
subject and an empty body. That title becomes the only commit on `main`, and is
what release-please reads to pick the next version and write the changelog line,
so it is the one that has to be right: a Conventional Commit, with `!` before
the colon for a breaking change. `.commitlintrc.json` admits `deps` beside the
standard types, lifts the header's length limit, since a title copied from an
issue can run past the preset's 100 characters and release-please reads one of
any length, and turns commitlint's default ignores off, so a title GitHub's
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
