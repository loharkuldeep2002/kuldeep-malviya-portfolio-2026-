'use strict';

const PRODUCTION_PROJECT_ID = 'kuldeep-malviya-portfolio';
const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

function resolveProject({ explicitProject, environmentProject, staging = false }) {
  const project = String(explicitProject || environmentProject || '').trim();
  if (!PROJECT_ID_PATTERN.test(project)) {
    throw new Error('Provide a valid Firebase project ID using --project.');
  }
  if (staging) {
    if (!explicitProject) throw new Error('Staging mode requires an explicit --project ID.');
    if (project === PRODUCTION_PROJECT_ID) throw new Error('Staging mode cannot target the production project.');
    return project;
  }
  if (project !== PRODUCTION_PROJECT_ID) {
    throw new Error('Non-production targets require --staging and an explicit --project ID.');
  }
  return project;
}

module.exports = { resolveProject, PRODUCTION_PROJECT_ID };
