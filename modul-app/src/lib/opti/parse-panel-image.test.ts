/**
 * Run: npx tsx --test src/lib/opti/parse-panel-image.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { visionLinesToParsedRows } from './panel-text-import'
import {
  detectImageMediaType,
  normalizeVisionResult
} from './parse-panel-image'

describe('normalizeVisionResult', () => {
  it('clamps qty and drops empty rows', () => {
    const r = normalizeVisionResult(
      {
        documentKind: 'printed_table',
        warnings: ['Ellenőrizd a kézírást'],
        lines: [
          {
            rawText: '720 560 2',
            grainMm: 720,
            crossMm: 560,
            quantity: 2,
            quantityUncertain: false,
            dimsUncertain: false,
            confidence: 0.95,
            notes: null
          },
          {
            rawText: '',
            grainMm: null,
            crossMm: null,
            quantity: 0,
            quantityUncertain: true,
            dimsUncertain: true,
            confidence: 0.2,
            notes: null
          },
          {
            rawText: '800x400',
            grainMm: 800.4,
            crossMm: 400,
            quantity: 1.2,
            quantityUncertain: true,
            dimsUncertain: false,
            confidence: 0.8,
            notes: 'Db hiányzott'
          }
        ]
      },
      'test-model'
    )
    assert.equal(r.documentKind, 'printed_table')
    assert.equal(r.lines.length, 2)
    assert.equal(r.lines[0]?.quantity, 2)
    assert.equal(r.lines[1]?.grainMm, 800)
    assert.equal(r.lines[1]?.quantity, 1)
    assert.equal(r.warnings[0], 'Ellenőrizd a kézírást')
    assert.equal(r.model, 'test-model')
  })

  it('falls back unknown documentKind', () => {
    const r = normalizeVisionResult(
      { documentKind: 'nope', warnings: [], lines: [] },
      'm'
    )
    assert.equal(r.documentKind, 'unknown')
  })
})

describe('detectImageMediaType', () => {
  it('uses mime then extension', () => {
    assert.equal(detectImageMediaType('image/png'), 'image/png')
    assert.equal(detectImageMediaType(null, 'x.webp'), 'image/webp')
    assert.equal(detectImageMediaType('application/octet-stream', 'a.jpg'), 'image/jpeg')
  })
})

describe('visionLinesToParsedRows', () => {
  it('maps to preview rows with AI warn', () => {
    const rows = visionLinesToParsedRows(
      [
        {
          grainMm: 720,
          crossMm: 560,
          quantity: 2,
          confidence: 0.95,
          rawText: '720 560 2'
        },
        {
          grainMm: 800,
          crossMm: 400,
          quantity: 1,
          dimsUncertain: true,
          confidence: 0.5,
          quantityUncertain: true,
          rawText: '800?',
          notes: 'Homályos számjegy'
        },
        {
          grainMm: 9000,
          crossMm: 400,
          quantity: 1,
          rawText: '9000 400'
        }
      ],
      { maxGrainMm: 2780, maxCrossMm: 2050 }
    )
    assert.equal(rows[0]?.status, 'ok')
    assert.equal(rows[1]?.status, 'warn')
    assert.ok(rows[1]?.issues.some((i) => i.includes('AI bizonytalan')))
    assert.equal(rows[2]?.status, 'error')
  })
})
