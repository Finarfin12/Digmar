export function isValidExternalUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false
    }

    const hostname = url.hostname

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false
    }

    // Block private/internal IP ranges (IPv4)
    const parts = hostname.split('.')
    if (parts.length === 4) {
      const p1 = parseInt(parts[0], 10)
      const p2 = parseInt(parts[1], 10)
      
      if (p1 === 10) return false // 10.0.0.0/8
      if (p1 === 172 && p2 >= 16 && p2 <= 31) return false // 172.16.0.0/12
      if (p1 === 192 && p2 === 168) return false // 192.168.0.0/16
      if (p1 === 169 && p2 === 254) return false // 169.254.0.0/16 (Link-local)
      if (p1 === 0) return false // 0.0.0.0/8
    }

    return true
  } catch (err) {
    return false
  }
}
