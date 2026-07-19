const assert = require('node:assert/strict')
const { test } = require('node:test')
const mongoose = require('mongoose')

const Portfolio = require('../src/modules/portfolios/portfolio.model').default
const PortfolioAsset = require('../src/modules/portfolios/portfolioAsset.model').default
const PortfolioExperience = require('../src/modules/portfolios/portfolioExperience.model').default
const PortfolioMoment = require('../src/modules/portfolios/portfolioMoment.model').default
const portfolioDomainRouter = require('../src/modules/portfolios/portfolioDomain.routes').default
const {
  createPortfolio,
  serializePortfolio,
} = require('../src/modules/portfolios/portfolioCollection.service')

test('Portfolio schema enforces one document per applicant', () => {
  const applicantIndex = Portfolio.schema.indexes().find(([fields]) => (
    Object.keys(fields).length === 1 && fields.applicantId === 1
  ))

  assert.ok(applicantIndex)
  assert.equal(applicantIndex[1].unique, true)
})

test('public domain route wraps slug validation as Express middleware', () => {
  const publicRoute = portfolioDomainRouter.stack.find((layer) => (
    layer.route?.path === '/public/:slug' && layer.route?.methods?.get
  ))

  assert.ok(publicRoute)
  assert.equal(publicRoute.route.stack.length, 2)
  assert.equal(publicRoute.route.stack[0].handle.length, 3)
})

test('public Portfolio serialization exposes safe profile fields and no owner id', () => {
  const previousBaseUrl = process.env.PUBLIC_PORTFOLIO_BASE_URL
  delete process.env.PUBLIC_PORTFOLIO_BASE_URL
  try {
    const payload = serializePortfolio({
      _id: new mongoose.Types.ObjectId(),
      applicantId: new mongoose.Types.ObjectId(),
      title: 'My Portfolio',
      description: 'Selected work',
      visibility: 'PUBLIC',
      slug: 'alex-work',
      headline: 'Product designer',
      about: 'I design useful products.',
      desiredRole: 'Product Designer',
      skills: ['Research'],
      socialLinks: { website: 'https://example.com' },
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    }, {}, false)

    assert.equal(payload.publicUrl, '/p/alex-work')
    assert.equal(payload.headline, 'Product designer')
    assert.deepEqual(payload.skills, ['Research'])
    assert.equal('applicantId' in payload, false)
  } finally {
    if (previousBaseUrl === undefined) delete process.env.PUBLIC_PORTFOLIO_BASE_URL
    else process.env.PUBLIC_PORTFOLIO_BASE_URL = previousBaseUrl
  }
})

test('compatibility create rejects a second Portfolio without writing', async (t) => {
  const applicantId = new mongoose.Types.ObjectId()
  const existing = {
    _id: new mongoose.Types.ObjectId(),
    applicantId,
  }
  const create = t.mock.method(Portfolio, 'create')
  t.mock.method(Portfolio, 'findOne', () => ({
    sort: async () => existing,
  }))
  t.mock.method(PortfolioAsset, 'updateMany', async () => ({ acknowledged: true }))
  t.mock.method(PortfolioExperience, 'updateMany', async () => ({ acknowledged: true }))
  t.mock.method(PortfolioMoment, 'updateMany', async () => ({ acknowledged: true }))

  await assert.rejects(
    createPortfolio(applicantId, { title: 'Second Portfolio' }),
    (error) => error.statusCode === 409 && error.code === 'PORTFOLIO_ALREADY_EXISTS',
  )
  assert.equal(create.mock.callCount(), 0)
})
