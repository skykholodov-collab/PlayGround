import test from 'node:test'
import assert from 'node:assert/strict'
import { BODIES, PLANETS, SUN, angularSpeed, findBody } from '../src/data.js'

test('the catalog contains one star and eight planets', () => {
  assert.equal(BODIES.length, 9)
  assert.equal(PLANETS.length, 8)
  assert.equal(BODIES[0], SUN)
})

test('every body has unique identifiers and complete display data', () => {
  const ids = new Set(BODIES.map((body) => body.id))
  assert.equal(ids.size, BODIES.length)
  for (const body of BODIES) {
    assert.ok(body.name, `${body.id} needs a name`)
    assert.ok(body.description.length > 40, `${body.id} needs a description`)
    assert.ok(body.diameter, `${body.id} needs a diameter`)
    assert.ok(body.day, `${body.id} needs a rotation period`)
    assert.ok(body.year, `${body.id} needs a year length`)
    assert.ok(body.temp, `${body.id} needs a temperature`)
    assert.match(body.accent, /^#[0-9a-f]{6}$/i)
  }
})

test('planets are ordered outward and orbital speeds decrease with distance', () => {
  let previousOrbit = 0
  let previousSpeed = Infinity
  for (const planet of PLANETS) {
    assert.ok(planet.orbit > previousOrbit, `${planet.id} should orbit farther than the previous planet`)
    assert.ok(planet.au > 0, `${planet.id} needs an astronomical-unit distance`)
    const speed = angularSpeed(planet)
    assert.ok(speed > 0, `${planet.id} should move`)
    assert.ok(speed < previousSpeed, `${planet.id} should be slower than the inner planet`)
    previousOrbit = planet.orbit
    previousSpeed = speed
  }
})

test('body lookup returns known bodies only', () => {
  assert.equal(findBody('earth').name, 'Earth')
  assert.equal(findBody('sun').name, 'Sun')
  assert.equal(findBody('pluto'), null)
})
