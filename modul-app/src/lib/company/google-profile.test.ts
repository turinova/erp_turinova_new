import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  generateGoogleReviewCode,
  googleReviewInputError,
  isLinkPreviewAgent,
  parseGoogleReviewClickSource,
  parseGoogleReviewInput
} from './google-profile'

describe('parseGoogleReviewInput', () => {
  it('empty input', () => {
    assert.equal(parseGoogleReviewInput('  ').kind, 'empty')
    assert.equal(parseGoogleReviewInput(null).kind, 'empty')
  })

  it('g.page review link, with or without scheme / suffix', () => {
    for (const raw of [
      'https://g.page/r/CaBcD123xyz/review',
      'g.page/r/CaBcD123xyz/review',
      'http://g.page/r/CaBcD123xyz',
      'https://g.page/r/CaBcD123xyz/review?utm=x'
    ]) {
      const r = parseGoogleReviewInput(raw)
      assert.equal(r.kind, 'review_form', raw)
      assert.equal(r.reviewUrl, 'https://g.page/r/CaBcD123xyz/review', raw)
    }
  })

  it('writereview link extracts place id', () => {
    const r = parseGoogleReviewInput(
      'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4'
    )
    assert.equal(r.kind, 'review_form')
    assert.equal(r.placeId, 'ChIJN1t_tDeuEmsRUsoyG83frY4')
    assert.equal(
      r.reviewUrl,
      'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4'
    )
  })

  it('raw place id builds review url', () => {
    const r = parseGoogleReviewInput('ChIJN1t_tDeuEmsRUsoyG83frY4')
    assert.equal(r.kind, 'review_form')
    assert.equal(r.placeId, 'ChIJN1t_tDeuEmsRUsoyG83frY4')
  })

  it('maps.app.goo.gl is unverified but savable', () => {
    const r = parseGoogleReviewInput('https://maps.app.goo.gl/AbC123')
    assert.equal(r.kind, 'short_unverified')
    assert.equal(r.reviewUrl, 'https://maps.app.goo.gl/AbC123')
    assert.equal(googleReviewInputError(r), null)
  })

  it('maps place page is rejected with guidance', () => {
    for (const raw of [
      'https://www.google.com/maps/place/Turinova/@47.5,19.0,17z',
      'https://maps.google.com/?cid=123',
      'https://www.google.hu/maps/place/Valami'
    ]) {
      const r = parseGoogleReviewInput(raw)
      assert.equal(r.kind, 'profile_page', raw)
      assert.match(googleReviewInputError(r) ?? '', /értékelő űrlap/)
    }
  })

  it('non-google and broken input is invalid', () => {
    for (const raw of ['https://pelda.hu', 'javascript:alert(1)', 'g.page/r/', 'nem link']) {
      assert.equal(parseGoogleReviewInput(raw).kind, 'invalid', raw)
    }
  })
})

describe('helpers', () => {
  it('code is readable alphanumeric', () => {
    const code = generateGoogleReviewCode()
    assert.match(code, /^[A-Za-z2-9]{6}$/)
    assert.doesNotMatch(code, /[01OlI]/)
  })

  it('click source allowlist', () => {
    assert.equal(parseGoogleReviewClickSource('SMS'), 'sms')
    assert.equal(parseGoogleReviewClickSource(null), 'direct')
    assert.equal(parseGoogleReviewClickSource('valami'), 'other')
  })

  it('link preview agents are not clicks', () => {
    assert.equal(isLinkPreviewAgent('facebookexternalhit/1.1 Facebot Twitterbot/1.0'), true)
    assert.equal(isLinkPreviewAgent('WhatsApp/2.23'), true)
    assert.equal(isLinkPreviewAgent(null), true)
    assert.equal(
      isLinkPreviewAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
      ),
      false
    )
  })
})
