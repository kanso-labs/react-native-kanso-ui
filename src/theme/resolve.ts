type Attempt = Settled | { readonly reason: string }

/** A cubic Bézier curve's control points, as `cubic-bezier()` lists them. */
type Easing = readonly [x1: number, y1: number, x2: number, y2: number]

type Group = keyof ResolvedTheme

// The resolved theme with its groups writable, for the resolver to fill in.
type Groups = {
  -readonly [G in Group]: { [key: string]: ResolvedTheme[G][string] }
}

type Kind =
  | 'color'
  | 'duration'
  | 'easing'
  | 'fontFamily'
  | 'fontWeight'
  | 'length'
  | 'opacity'
  | 'shadow'

/**
 * The tokens in the values React Native styles take, grouped and keyed as the
 * web library's StyleX tokens are: `--kui-color-primary` is `colors.primary`
 * and `--kui-typography-body-large-size` is `typography.bodyLargeSize`.
 */
type ResolvedTheme = {
  readonly colors: Readonly<Record<string, string>>
  readonly motion: Readonly<Record<string, Easing | number>>
  readonly radii: Readonly<Record<string, number>>
  readonly shadows: Readonly<Record<string, string>>
  readonly sizing: Readonly<Record<string, number>>
  readonly spacing: Readonly<Record<string, number>>
  readonly stateLayerOpacity: Readonly<Record<string, number>>
  readonly typography: Readonly<Record<string, number | readonly string[]>>
}

type Settled = { readonly raw: string; readonly value: Value }

/** A property whose value could not be used, and why. */
type ThemeProblem = {
  readonly property: string
  readonly reason: string
  readonly value: string
}

/**
 * A set of `--kui-*` custom properties and their values, written in CSS syntax
 * exactly as kanso-ui's `tokens.css` declares them, so one theme serves both
 * libraries.
 */
type ThemeProperties = Readonly<Partial<Record<`--kui-${string}`, string>>>

type Value = Easing | number | readonly string[] | string

// The segment each group takes in a property's name, as kanso-ui's
// build-tokens.mjs writes it: singular where the group's own name is plural.
const CATEGORIES: readonly (readonly [string, Group])[] = [
  ['color', 'colors'],
  ['motion', 'motion'],
  ['radius', 'radii'],
  ['shadow', 'shadows'],
  ['sizing', 'sizing'],
  ['spacing', 'spacing'],
  ['state-layer-opacity', 'stateLayerOpacity'],
  ['typography', 'typography'],
]

// The CSS keywords a timing function may be written as, as the curves the
// CSS Easing specification defines them to be.
const EASING_KEYWORDS: Readonly<Partial<Record<string, Easing>>> = {
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  'ease-out': [0, 0, 0.58, 1],
  linear: [0, 0, 1, 1],
}

const FONT_WEIGHT_KEYWORDS: Readonly<Partial<Record<string, number>>> = {
  bold: 700,
  normal: 400,
}

// Functions a browser evaluates and React Native does not. `var()` is the one
// CSS function the resolver evaluates itself, so it is not among them.
const UNSUPPORTED_FUNCTION =
  /\b(attr|calc|clamp|color-mix|env|light-dark|max|min)\(/u

const NUMBER = String.raw`-?(?:\d+\.?\d*|\.\d+)`

function camelCase(kebab: string): string {
  return kebab.replaceAll(/-([a-z0-9])/gu, (_, letter: string) =>
    letter.toUpperCase(),
  )
}

/** The group a property belongs to, the key it takes there, and its kind. */
function classify(
  property: string,
): undefined | { group: Group; key: string; kind: Kind } {
  if (!property.startsWith('--kui-')) {
    return undefined
  }

  const name = property.slice('--kui-'.length)
  const match = CATEGORIES.find(([category]) => name.startsWith(`${category}-`))

  if (match === undefined) {
    return undefined
  }

  const [category, group] = match
  const rest = name.slice(category.length + 1)
  const kind = kindOf(category, rest)

  return kind === undefined ? undefined : { group, key: camelCase(rest), kind }
}

/** The index of the parenthesis closing the one just before `from`. */
function closingParenthesis(value: string, from: number): number {
  let depth = 1

  for (let index = from; index < value.length; index++) {
    if (value[index] === '(') {
      depth++
    } else if (value[index] === ')') {
      depth--

      if (depth === 0) {
        return index
      }
    }
  }

  return -1
}

function kindOf(category: string, rest: string): Kind | undefined {
  switch (category) {
    case 'color': {
      return 'color'
    }
    case 'motion': {
      if (rest.startsWith('duration-')) {
        return 'duration'
      }

      return rest.startsWith('easing-') ? 'easing' : undefined
    }
    case 'radius':
    case 'sizing':
    case 'spacing': {
      return 'length'
    }
    case 'shadow': {
      return 'shadow'
    }
    case 'state-layer-opacity': {
      return 'opacity'
    }
    default: {
      return typographyKindOf(rest)
    }
  }
}

function parseColor(value: string): string | undefined {
  const drawable =
    /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/iu.test(value) ||
    /^(rgba?|hsla?|hwb)\([^()]*\)$/iu.test(value) ||
    /^[a-z]+$/iu.test(value)

  return drawable ? value : undefined
}

function parseDuration(value: string): number | undefined {
  const match = /^(\d+\.?\d*|\.\d+)(ms|s)$/u.exec(value)

  if (match === null) {
    return undefined
  }

  const duration = Number(match[1])

  return match[2] === 's' ? duration * 1000 : duration
}

function parseEasing(value: string): Easing | undefined {
  const keyword = EASING_KEYWORDS[value]

  if (keyword !== undefined) {
    return keyword
  }

  const match = /^cubic-bezier\(([^()]*)\)$/u.exec(value)

  if (match === null) {
    return undefined
  }

  const points = match[1].split(',').map((point) => point.trim())

  if (
    points.length !== 4 ||
    !points.every((point) => new RegExp(`^${NUMBER}$`, 'u').test(point))
  ) {
    return undefined
  }

  const [x1, y1, x2, y2] = points.map(Number)

  // The curve has to stay a function of time, which is what holds both x
  // coordinates inside the unit interval.
  return [x1, x2].every((x) => x >= 0 && x <= 1) ? [x1, y1, x2, y2] : undefined
}

function parseFontFamily(value: string): readonly string[] | undefined {
  const families = splitTopLevel(value).map((family) =>
    family.trim().replace(/^(["'])(.*)\1$/u, '$2'),
  )

  return families.every((family) => family !== '' && !family.includes('('))
    ? families
    : undefined
}

function parseFontWeight(value: string): number | undefined {
  const keyword = FONT_WEIGHT_KEYWORDS[value]

  if (keyword !== undefined) {
    return keyword
  }

  if (!/^\d+(\.\d+)?$/u.test(value)) {
    return undefined
  }

  const weight = Number(value)

  return weight >= 1 && weight <= 1000 ? weight : undefined
}

function parseLength(value: string): number | undefined {
  const match = new RegExp(`^(${NUMBER})(px)?$`, 'u').exec(value)

  if (match === null) {
    return undefined
  }

  const length = Number(match[1])

  // CSS takes a bare number as a length only when it is zero.
  return match[2] !== 'px' && length !== 0 ? undefined : length
}

function parseOpacity(value: string): number | undefined {
  const match = new RegExp(`^(${NUMBER})(%)?$`, 'u').exec(value)

  if (match === null) {
    return undefined
  }

  const opacity = Number(match[1]) / (match[2] === '%' ? 100 : 1)

  // CSS clamps an opacity to the unit interval rather than rejecting it.
  return Math.min(Math.max(opacity, 0), 1)
}

function parseShadow(value: string): string | undefined {
  return value === '' ? undefined : value
}

/** Splits a value at its top-level commas, leaving any inside parentheses. */
function splitTopLevel(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | undefined
  let start = 0

  for (let index = 0; index < value.length; index++) {
    const character = value[index]

    if (quote !== undefined) {
      quote = character === quote ? undefined : quote
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character === '(') {
      depth++
    } else if (character === ')') {
      depth--
    } else if (character === ',' && depth === 0) {
      parts.push(value.slice(start, index))
      start = index + 1
    }
  }

  parts.push(value.slice(start))

  return parts
}

function typographyKindOf(rest: string): Kind | undefined {
  if (rest.startsWith('font-family-') || rest.endsWith('-font')) {
    return 'fontFamily'
  }

  if (rest.startsWith('weight-') || rest.endsWith('-weight')) {
    return 'fontWeight'
  }

  const measured = ['-line-height', '-size', '-tracking'].some((suffix) =>
    rest.endsWith(suffix),
  )

  return measured ? 'length' : undefined
}

// How each kind of value is read, and what a value that cannot be read is
// reported as.
const PARSERS: Readonly<
  Record<Kind, readonly [(value: string) => undefined | Value, string]>
> = {
  color: [parseColor, 'is not a colour React Native can draw'],
  duration: [parseDuration, 'is not a duration in ms or s'],
  easing: [parseEasing, 'is not a cubic-bezier() curve or an easing keyword'],
  fontFamily: [parseFontFamily, 'is not a font family list'],
  fontWeight: [parseFontWeight, 'is not a font weight from 1 to 1000'],
  length: [parseLength, 'is not a length in px'],
  opacity: [parseOpacity, 'is not a number or a percentage'],
  shadow: [parseShadow, 'is empty'],
}

/** The properties a theme declares, leaving out any it lists as undefined. */
function declarations(properties: ThemeProperties): Map<string, string> {
  return new Map(
    Object.entries(properties).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  )
}

/**
 * Turns a theme in CSS syntax into the values React Native styles take.
 *
 * `defaults` is the whole contract, and `overrides` replace any of it, as a
 * consumer's declarations replace the library's on web. A `var()` reference
 * resolves against both, with its fallback where the property it names has no
 * usable value, so a role pointing at a family or a weight follows an override
 * of that family or weight as it does in a browser.
 *
 * A value native cannot use, such as a `calc()` or a `color-mix()`, leaves its
 * property at the default instead of dropping it, and a property the defaults
 * do not declare is ignored. Each is listed in `problems` by name, for the
 * caller to report.
 */
function resolveTheme(
  defaults: ThemeProperties,
  overrides: ThemeProperties = {},
): { problems: readonly ThemeProblem[]; theme: ResolvedTheme } {
  const declared = declarations(defaults)
  const replaced = declarations(overrides)
  const problems: ThemeProblem[] = []
  const settled = new Map<string, null | Settled>()
  const settling: string[] = []
  const cyclic = new Set<string>()

  function substitute(value: string): string | { reason: string } {
    const start = value.indexOf('var(')

    if (start === -1) {
      return value
    }

    const end = closingParenthesis(value, start + 'var('.length)

    if (end === -1) {
      return { reason: 'has a var() that is never closed' }
    }

    const [name, ...rest] = splitTopLevel(
      value.slice(start + 'var('.length, end),
    )
    const property = name.trim()
    const fallback = rest.length === 0 ? undefined : rest.join(',').trim()
    const referenced = declared.has(property) ? settle(property) : null

    let replacement: string | { reason: string }

    if (referenced !== null) {
      replacement = referenced.raw
    } else if (fallback === undefined) {
      replacement = {
        reason: `refers to ${property}, which has no usable value`,
      }
    } else {
      replacement = substitute(fallback)
    }

    if (typeof replacement !== 'string') {
      return replacement
    }

    return substitute(
      `${value.slice(0, start)}${replacement}${value.slice(end + 1)}`,
    )
  }

  function evaluate(kind: Kind, value: string): Attempt {
    const raw = substitute(value.trim())

    if (typeof raw !== 'string') {
      return raw
    }

    const unsupported = UNSUPPORTED_FUNCTION.exec(raw)

    if (unsupported !== null) {
      return {
        reason: `uses ${unsupported[1]}(), which native cannot evaluate`,
      }
    }

    const [read, reason] = PARSERS[kind]
    const parsed = read(raw)

    return parsed === undefined ? { reason } : { raw, value: parsed }
  }

  /** Evaluates one declaration, listing it as a problem if it fails. */
  function attempt(
    property: string,
    kind: Kind,
    value: string | undefined,
  ): null | Settled {
    if (value === undefined) {
      return null
    }

    const result = evaluate(kind, value)

    if ('reason' in result) {
      problems.push({ property, reason: result.reason, value })

      return null
    }

    return result
  }

  function settle(property: string): null | Settled {
    const known = settled.get(property)

    if (known !== undefined) {
      return known
    }

    const classified = classify(property)

    if (classified === undefined) {
      return null
    }

    // A reference leading back to a property still being settled closes a
    // cycle, and every property on it is invalid, as in CSS. The defaults
    // hold no cycle, so the members fall back to theirs.
    const index = settling.indexOf(property)

    if (index !== -1) {
      for (const member of settling.slice(index)) {
        cyclic.add(member)
      }

      return null
    }

    settling.push(property)

    const value = replaced.get(property)
    let result = attempt(property, classified.kind, value)

    if (result !== null && value !== undefined && cyclic.has(property)) {
      problems.push({
        property,
        reason: 'refers back to itself through var()',
        value,
      })
      result = null
    }

    result ??= attempt(property, classified.kind, declared.get(property))

    settling.pop()
    settled.set(property, result)

    return result
  }

  const theme: Groups = {
    colors: {},
    motion: {},
    radii: {},
    shadows: {},
    sizing: {},
    spacing: {},
    stateLayerOpacity: {},
    typography: {},
  }

  for (const [property, value] of declared) {
    const classified = classify(property)

    if (classified === undefined) {
      problems.push({ property, reason: 'is not a Kanso UI token', value })

      continue
    }

    const result = settle(property)

    // classify() pairs every group with the kinds whose values it holds, which
    // is the one thing the type of a group's record cannot see.
    if (result !== null) {
      Object.assign(theme[classified.group], { [classified.key]: result.value })
    }
  }

  for (const [property, value] of replaced) {
    if (!declared.has(property)) {
      problems.push({ property, reason: 'is not a Kanso UI token', value })
    }
  }

  return { problems, theme }
}

export type { Easing, ResolvedTheme, ThemeProblem, ThemeProperties }
export { resolveTheme }
