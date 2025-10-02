'use strict';

const crypto = require('node:crypto');

exports.config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(secret, payload, signatureHeader) {
  if (!secret) return true; // skip verification when no secret configured.
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac('sha1', secret)
    .update(payload)
    .digest('hex');
  // Vercel prepends sha1= to the signature value.
  const received = signatureHeader.replace(/^sha1=/, '');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.end('Method Not Allowed');
    return;
  }

  const rawBody = await readRawBody(req);
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  const signature = req.headers['x-vercel-signature'];

  if (!verifySignature(secret, rawBody, signature)) {
    res.statusCode = 401;
    res.end('Invalid signature');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    res.statusCode = 400;
    res.end('Unable to parse payload');
    return;
  }

  const deployment = payload.deployment || {};
  const deploymentId = deployment.id || deployment.uid || payload.id || '';
  const commitSha = deployment.meta?.githubCommitSha
    || deployment.meta?.commitSha
    || payload.payload?.meta?.commitSha
    || payload.meta?.commitSha
    || '';
  const prNumber = deployment.meta?.githubPrNumber
    || payload.payload?.meta?.prNumber
    || payload.meta?.prNumber
    || null;
  const deploymentUrl = deployment.url ? `https://${deployment.url}` : '';

  const owner = process.env.GITHUB_OWNER || 'evschneider-hmi';
  const repo = process.env.GITHUB_REPO || 'ps-html5auditor';
  const token = process.env.GITHUB_DISPATCH_TOKEN;

  if (!token) {
    res.statusCode = 500;
    res.end('Missing GITHUB_DISPATCH_TOKEN environment variable');
    return;
  }

  const body = {
    event_type: 'vercel-deployment-error',
    client_payload: {
      deploymentId,
      commitSha,
      prNumber,
      url: deploymentUrl,
    },
  };

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'ps-html5auditor-vercel-bridge',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    res.statusCode = 502;
    res.end(`Failed to dispatch to GitHub: ${response.status} ${text}`);
    return;
  }

  res.statusCode = 202;
  res.end('Dispatch queued');
};
