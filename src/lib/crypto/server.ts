import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
const ALGORITHM = 'aes-256-gcm'

export function encryptValue(text: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters.')
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag().toString('hex')
  
  const combined = `${iv.toString('hex')}:${authTag}:${encrypted}`
  
  // Return as hex string for Postgres BYTEA
  return `\\x${Buffer.from(combined, 'utf8').toString('hex')}`
}

export function decryptValue(hexString: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters.')
  }

  let cleanHex = hexString
  if (hexString.startsWith('\\x')) {
    cleanHex = hexString.substring(2)
  } else if (hexString.startsWith('x')) {
    cleanHex = hexString.substring(1)
  }
  
  const combined = Buffer.from(cleanHex, 'hex').toString('utf8')
  const parts = combined.split(':')
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format.')
  }
  
  const [ivHex, authTagHex, encryptedHex] = parts
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY),
    Buffer.from(ivHex, 'hex')
  )
  
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}
