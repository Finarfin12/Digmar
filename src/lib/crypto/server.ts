import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
const ALGORITHM = 'aes-256-gcm'

// C11 Fix: Use KDF instead of raw key
function getDerivedKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not defined.')
  }
  // Using a static salt since we need deterministic key derivation for existing/future data
  const salt = process.env.ENCRYPTION_SALT || 'digimar-static-salt-v1'
  return crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha256')
}

export function encryptValue(text: string): string {
  const derivedKey = getDerivedKey()

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag().toString('hex')
  
  const combined = `${iv.toString('hex')}:${authTag}:${encrypted}`
  
  // Return as hex string for Postgres BYTEA
  return `\\x${Buffer.from(combined, 'utf8').toString('hex')}`
}

export function decryptValue(hexString: string): string {
  const derivedKey = getDerivedKey()

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
    derivedKey,
    Buffer.from(ivHex, 'hex')
  )
  
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}
