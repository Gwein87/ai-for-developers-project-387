import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const readyLabels = new Set(['ready-for-agent', 'ready-for-human'])

export function shouldReview(issue, permission, alreadyReviewed) {
  return issue.state === 'open' && !issue.pull_request && issue.user.type === 'User'
    && !issue.performed_via_github_app
    && !issue.labels.some(({ name }) => readyLabels.has(name.toLowerCase()))
    && ['admin', 'write'].includes(permission(issue.user.login))
    && !alreadyReviewed()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { issue } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const repo = `repos/${process.env.GITHUB_REPOSITORY}`
  const endpoint = `${repo}/issues/${issue.number}`
  const gh = (...args) => execFileSync('gh', ['api', ...args], { encoding: 'utf8' }).trim()
  const review = shouldReview(
    JSON.parse(gh(endpoint)),
    login => gh(`${repo}/collaborators/${login}/permission`, '--jq', '.permission'),
    () => Boolean(gh(`${endpoint}/comments`, '--paginate', '--jq',
      '.[] | select(.user.login == "github-actions[bot]" and (.body | contains("<!-- opencode:initial-triage -->"))) | .id')),
  )
  appendFileSync(process.env.GITHUB_OUTPUT, `review=${review}\n`)
}
