import { THICKNESS } from './styles'

// The paths a progress indicator draws its curves along: an arc of a circle,
// an arc of a circle with a wave round it, and a wave along a line. Each is
// built from where it starts and how far it runs, so a curve that moves is a
// new path each frame rather than a dash pattern that moves.
//
// Web cuts its arcs and waves out of whole curves with `stroke-dasharray`,
// normalised by `pathLength` so a dash reads as a share of the way round.
// react-native-svg has no `pathLength`, and a dash pattern Reanimated moves
// frame by frame is the least reliable of an svg's props across iOS, Android
// and the web, so here the cut is made in the path itself, which every
// platform redraws alike. The geometry is web's: the same circles, the same
// waves, and the same lengths along them.
//
// Every builder is a worklet, so it runs on the UI thread with the animation
// that moves it, and a test can call it as it stands. Each is whole on its
// own, its helpers nested inside it: a worklet captures what it calls when the
// module is evaluated, so one calling another declared below it would be
// handed nothing, and the linter orders declarations by name, not by use.

// Three decimal places, which keeps a path short without moving a point by
// anything a screen could show, as web rounds its own.
const PLACES = 3

/** A full turn, in radians. */
const TURN = 2 * Math.PI

// The least an arc runs. Web's zero-length dash still draws, as a dot the
// size of the stroke, since a round cap is drawn at either end of a dash of
// any length; an svg path of no length draws nothing at all, so the arc is
// given this much instead, which is the same dot.
const DOT = 0.001

// The wave along the line: its amplitude either side of the middle, and the
// row it is drawn in, which is the amplitude either side plus the stroke.
// It starts half a stroke in, so its round cap starts at the row's edge.
const WAVE_AMPLITUDE = 3
const WAVE_HEIGHT = WAVE_AMPLITUDE * 2 + THICKNESS
const WAVE_ORIGIN = THICKNESS / 2

// How many points a wavelength is drawn through: web draws a line's wave as
// cubic half waves and a ring's as twenty points to a wave. A wave cut short
// partway through a cubic would need it split, so both are drawn as points
// here, finely enough that the joins are below what the 4dp stroke shows.
const POINTS_PER_WAVELENGTH = 16
const POINTS_PER_RING_WAVE = 20

/** A circle a ring's wave runs round, and the wave. */
type RingWave = {
  /** How far the wave rises either side of the circle. */
  readonly amplitude: number
  /** The centre, on both axes. */
  readonly centre: number
  /** The circle's radius. */
  readonly radius: number
  /** How many crests the wave has round the whole circle. */
  readonly waves: number
}

/**
 * An arc of the circle about (`centre`, `centre`), clockwise from `from` for
 * `sweep` radians, both measured from the top. A sweep of nothing draws a dot,
 * as web's zero-length dash does, and a full turn stops short of closing by
 * a hair the round caps cover, since an arc that ends where it starts is no
 * arc at all.
 */
function arcPath(centre: number, radius: number, from: number, sweep: number) {
  'worklet'
  const span = Math.min(Math.max(sweep, DOT), TURN - DOT)
  const large = span > Math.PI ? 1 : 0

  // A point on the circle, `angle` radians clockwise from the top.
  function point(angle: number) {
    const x = centre + radius * Math.sin(angle)
    const y = centre - radius * Math.cos(angle)
    return `${x.toFixed(PLACES)} ${y.toFixed(PLACES)}`
  }

  return `M${point(from)}A${radius} ${radius} 0 ${large} 1 ${point(from + span)}`
}

/**
 * A stretch of the wave along a line, from `from` to `to` across its row, on a
 * wave `wavelength` long that rises first from `WAVE_ORIGIN`, as web's does.
 * Nothing when the stretch is empty, which is how a bar that has not yet
 * reached the row, or has left it, draws nothing.
 */
function wavePath(wavelength: number, from: number, to: number) {
  'worklet'
  if (to <= from) {
    return ''
  }

  // The point on the wave above `x`.
  function point(x: number) {
    const crest = Math.sin((TURN * (x - WAVE_ORIGIN)) / wavelength)
    const y = WAVE_HEIGHT / 2 - WAVE_AMPLITUDE * crest
    return `${x.toFixed(PLACES)} ${y.toFixed(PLACES)}`
  }

  const step = wavelength / POINTS_PER_WAVELENGTH
  let path = `M${point(from)}`
  for (
    let index = Math.floor((from - WAVE_ORIGIN) / step) + 1;
    WAVE_ORIGIN + index * step < to;
    index++
  ) {
    path += `L${point(WAVE_ORIGIN + index * step)}`
  }

  return `${path}L${point(to)}`
}

/**
 * A stretch of a ring's wave, clockwise from `from` for `sweep` radians, both
 * measured from the top, as `arcPath` takes them. `phase` is the angle the
 * wave rises from, which turns with a spinning ring so its crests turn with
 * it. A sweep of nothing draws a dot, as an arc's does.
 */
function wavyArcPath(
  wave: RingWave,
  phase: number,
  from: number,
  sweep: number,
) {
  'worklet'
  const { amplitude, centre, radius, waves } = wave

  // The point on the wave at `angle`, clockwise from the top.
  function point(angle: number) {
    const reach = radius + amplitude * Math.sin(waves * (angle - phase))
    const x = centre + reach * Math.sin(angle)
    const y = centre - reach * Math.cos(angle)
    return `${x.toFixed(PLACES)} ${y.toFixed(PLACES)}`
  }

  const step = TURN / (waves * POINTS_PER_RING_WAVE)
  const to = from + Math.min(Math.max(sweep, DOT), TURN)
  let path = `M${point(from)}`
  for (let index = Math.floor(from / step) + 1; index * step < to; index++) {
    path += `L${point(index * step)}`
  }

  return `${path}L${point(to)}`
}

export { arcPath, TURN, WAVE_HEIGHT, WAVE_ORIGIN, wavePath, wavyArcPath }
export type { RingWave }
