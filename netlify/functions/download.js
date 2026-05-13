// ── Download proxy ───────────────────────────────────────────────────────────
// Fetches the latest GitHub release and redirects to the matching asset URL.
//
// Usage:
//   /download/arm64   →  latest arm64 DMG (Apple Silicon)
//   /download/x64     →  latest x64 DMG (Intel Mac)
//   /download/windows →  latest Windows NSIS installer (.exe)
//
// GITHUB_TOKEN is used only for the releases/latest API call (rate limiting).
// The actual download uses browser_download_url — a public URL that needs no
// auth — avoiding issues with tokens scoped to other repos.
// ─────────────────────────────────────────────────────────────────────────────

const REPO = 'vietch2612/daybar-app';

exports.handler = async (event) => {
  const path = event.path || '';
  const platform = path.includes('windows') ? 'windows'
    : path.includes('x64') ? 'x64'
    : 'arm64';
  const token = process.env.GITHUB_TOKEN;

  try {
    // 1. Get the latest release metadata
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'daybar-website',
    };
    if (token) headers.Authorization = `token ${token}`;

    const releaseRes = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      { headers }
    );

    if (!releaseRes.ok) {
      return { statusCode: 502, body: `GitHub API error: ${releaseRes.status}` };
    }

    const release = await releaseRes.json();

    // 2. Find the matching asset
    const asset = release.assets.find((a) => {
      if (platform === 'windows') return a.name.endsWith('.exe');
      if (!a.name.endsWith('.dmg')) return false;
      if (platform === 'arm64') return a.name.includes('arm64');
      // x64: DMG without "arm64" in the name
      return !a.name.includes('arm64');
    });

    if (!asset) {
      return { statusCode: 404, body: `No ${platform} asset found in release ${release.tag_name}` };
    }

    // 3. Redirect directly to the public browser_download_url.
    //    This is the same URL shown on the GitHub releases page — no auth
    //    needed, works regardless of which repo the GITHUB_TOKEN is scoped to.
    return {
      statusCode: 302,
      headers: { Location: asset.browser_download_url },
    };
  } catch (err) {
    return { statusCode: 500, body: `Download error: ${err.message}` };
  }
};
