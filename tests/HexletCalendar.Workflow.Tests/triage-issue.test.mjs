import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldReview } from '../../scripts/triage-issue.mjs'

const issue = { state: 'open', user: { login: 'reporter', type: 'User' }, labels: [] }

test('uses the repository permission of the issue author', () => {
  for (const permission of ['admin', 'write', 'read', 'none']) {
    const result = shouldReview(issue, login => {
      assert.equal(login, issue.user.login)
      return permission
    }, () => false)
    assert.equal(result, ['admin', 'write'].includes(permission))
  }
})

test('skips ready tickets, bots, app events, closed issues and pull requests before permission lookup', () => {
  const changes = [
    { labels: [{ name: 'ready-for-agent' }] }, { labels: [{ name: 'ready-for-human' }] },
    { user: { type: 'Bot' } }, { performed_via_github_app: {} }, { state: 'closed' }, { pull_request: {} },
  ]
  for (const change of changes) {
    assert.equal(shouldReview({ ...issue, ...change }, assert.fail, assert.fail), false)
  }
})

test('skips an issue that already has the automatic review', () => {
  assert.equal(shouldReview(issue, () => 'write', () => true), false)
})
