// Satu sumber versi Graph API Meta untuk semua route
export const META_API_VERSION = process.env.META_API_VERSION || 'v25.0'
export const GRAPH_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`
