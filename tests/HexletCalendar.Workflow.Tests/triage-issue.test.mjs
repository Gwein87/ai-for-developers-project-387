import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareReview, publishReview } from '../../scripts/triage-issue.mjs'

const events = [
  { type: 'step_start' },
  { type: 'reasoning', part: { text: 'Internal reasoning' } },
  { type: 'text', part: { text: 'Which date?' } },
  { type: 'step_finish' },
].map(event => JSON.stringify(event)).join('\n')

function fixture(overrides = {}) {
  const issue = { state: 'open', user: { type: 'User' }, labels: [], title: 'Booking', body: 'Missing slot', ...overrides }
  const reviews = []
  const comments = []
  const github = {
    readIssue: () => issue,
    alreadyPosted: () => comments.length > 0,
    post: body => comments.push(body),
  }
  const run = () => {
    const report = prepareReview(github)
    if (report) {
      reviews.push(report)
      publishReview(github, events)
    }
  }
  return { run, reviews, comments, issue, github }
}

test('reviews a new report once, including on a workflow rerun', async () => {
  const { run, reviews, comments } = fixture()
  await run()
  await run()
  assert.deepEqual(reviews, [{ title: 'Booking', body: 'Missing slot' }])
  assert.equal(comments.length, 1)
  assert.match(comments[0], /Which date\?/)
  assert.doesNotMatch(comments[0], /Internal reasoning/)
})

for (const name of ['ready-for-agent', 'ready-for-human']) {
  test(`skips ${name} before requesting a review`, async () => {
    const { run, reviews, comments } = fixture({ labels: [{ name }] })
    await run()
    assert.equal(reviews.length, 0)
    assert.equal(comments.length, 0)
  })
}

test('skips bot issues', async () => {
  const { run, reviews } = fixture({ user: { type: 'Bot' } })
  await run()
  assert.equal(reviews.length, 0)
})

test('respects a ready label applied during review', () => {
  const { issue, github, comments } = fixture()
  assert.ok(prepareReview(github))
  issue.labels.push({ name: 'ready-for-agent' })
  publishReview(github, events)
  assert.equal(comments.length, 0)
})

test('does not publish incomplete or empty CLI output', () => {
  const { github, comments } = fixture()
  assert.throws(() => publishReview(github, events + '\n{"type":"error"}'), /failed review/)
  assert.throws(() => publishReview(github, '{"type":"step_start"}'), /Empty triage response/)
  assert.equal(comments.length, 0)
})
