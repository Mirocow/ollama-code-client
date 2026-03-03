import nextra from 'nextra';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const repoName = process.env.REPO_NAME || 'ollama-code';

const withNextra = nextra({
  defaultShowCopyCode: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isGitHubPages ? 'export' : undefined,
  basePath: isGitHubPages ? `/${repoName}` : '',
  images: isGitHubPages ? { unoptimized: true } : undefined,
  trailingSlash: true,
  turbopack: {},
};

export default withNextra(nextConfig);
