const SUPPORTED_EXTENSIONS = ['.exe', '.dmg', '.zip', '.appimage', '.deb']

export function classifyReleaseFile(filename) {
  const lower = String(filename || '').toLowerCase()
  if (!SUPPORTED_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    throw new Error(`Unsupported release file: ${filename}`)
  }

  const os =
    lower.includes('win') || lower.endsWith('.exe')
      ? 'windows'
      : lower.includes('mac') || lower.endsWith('.dmg')
        ? 'macos'
        : 'linux'
  const arch =
    lower.includes('arm64') || lower.includes('aarch64')
      ? 'arm64'
      : /(?:ia32|win32|x86(?![_-]?64))/.test(lower)
        ? 'ia32'
        : 'x64'
  const type = lower.endsWith('.dmg')
    ? 'dmg'
    : lower.endsWith('.appimage')
      ? 'appimage'
      : lower.endsWith('.deb')
        ? 'deb'
        : lower.endsWith('.zip')
          ? 'zip'
          : 'setup'

  return { os, arch, type, id: `${os}-${arch}-${type}` }
}

export function publicAssetUrl(baseUrl, filename, releasePath = 'latest') {
  let url
  try {
    url = new URL(baseUrl)
  } catch {
    throw new Error('R2 public base URL must use HTTPS')
  }
  if (url.protocol !== 'https:') throw new Error('R2 public base URL must use HTTPS')
  const basePath = url.pathname.replace(/\/+$/, '')
  url.pathname = `${basePath}/releases/${encodeURIComponent(releasePath)}/${encodeURIComponent(filename)}`
  url.search = ''
  url.hash = ''
  return url.toString()
}
