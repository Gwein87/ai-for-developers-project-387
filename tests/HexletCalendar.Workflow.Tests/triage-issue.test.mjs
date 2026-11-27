import assert from 'node:assert/strict'
import test from 'node:test'
import { triage } from '../../scripts/triage-issue.mjs'

function fixture(overrides = {}) {
  const issue = { state: 'open', user: { type: 'User' }, labels: [], title: 'Booking', body: 'Missing slot', ...overrides }
  const reviews = []
  const comments = []
  const run = () => triage({
    readIssue: () => issue,
    alreadyPosted: () => comments.length > 0,
    review: report => { reviews.push(report); return 'Which date?' },
    post: body => comments.push(body),
  })
  return { run, reviews, comments, issue }
}

test('reviews a new report once, including on a workflow rerun', async () => {
  const { run, reviews, comments } = fixture()
  await run()
  await run()
  assert.deepEqual(reviews, [{ title: 'Booking', body: 'Missing slot' }])
  assert.equal(comments.length, 1)
  assert.match(comments[0], /Which date\?/)
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

test('respects a ready label applied during review', async () => {
  const { issue } = fixture()
  await triage({
    readIssue: () => issue,
    alreadyPosted: () => false,
    review: () => { issue.labels.push({ name: 'ready-for-agent' }); return 'Review' },
    post: () => assert.fail('Ready ticket received an automatic comment'),
  })
})
