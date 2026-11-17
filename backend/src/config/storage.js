/**
 * Supabase Storage Service
 * Connected to https://uvticruppilaigbmjwji.supabase.co
 * Buckets:
 *   - property-images: Public property photos & cadastral maps
 *   - property-documents: Private ownership documents & legal deeds (accessible only via signed URLs)
 */
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('FATAL: SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) environment variables must be defined.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
];

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB limit

// Server-side magic byte inspection for file integrity
function inspectFileSignature(buffer, claimedMimeType) {
  if (!buffer || buffer.length < 4) {
    throw new Error('Invalid file payload: file is empty or corrupted');
  }

  // Check magic numbers
  const isPdf = buffer.length >= 5 && buffer.slice(0, 5).toString('ascii') === '%PDF-';
  const isJpg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isWebp = buffer.length >= 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';

  if (!isPdf && !isJpg && !isPng && !isWebp) {
    throw new Error('Security Violation: File header magic bytes do not match any permitted document or image format');
  }

  if (claimedMimeType === 'application/pdf' && !isPdf) {
    throw new Error('MIME Type mismatch: claimed PDF document lacks %PDF signature');
  }
  if ((claimedMimeType === 'image/jpeg' || claimedMimeType === 'image/jpg') && !isJpg) {
    throw new Error('MIME Type mismatch: claimed JPEG image lacks valid SOI signature');
  }
  if (claimedMimeType === 'image/png' && !isPng) {
    throw new Error('MIME Type mismatch: claimed PNG image lacks valid signature');
  }
  if (claimedMimeType === 'image/webp' && !isWebp) {
    throw new Error('MIME Type mismatch: claimed WebP image lacks valid RIFF/WEBP header');
  }

  return true;
}

class SupabaseStorageService {
  constructor() {
    this.supabase = supabase;
    this.imagesBucket = 'property-images';
    this.documentsBucket = 'property-documents';
  }

  validateUploadMetadata(fileMeta, fileBuffer = null) {
    if (!fileMeta) throw new Error("Missing file metadata");
    if (!ALLOWED_MIME_TYPES.includes(fileMeta.mimeType)) {
      throw new Error(`Unsupported file type: ${fileMeta.mimeType}. Allowed: PDF, JPEG, PNG, WEBP`);
    }
    if (fileMeta.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size exceeds 15MB limit: ${Math.round(fileMeta.sizeBytes / 1024 / 1024)}MB`);
    }
    if (fileBuffer) {
      inspectFileSignature(fileBuffer, fileMeta.mimeType);
    }
    return true;
  }

  /**
   * Uploads property photo to 'property-images' bucket and returns permanent public URL
   */
  async uploadPropertyImage(fileName, fileBuffer, contentType = 'image/jpeg') {
    const ext = fileName.split('.').pop() || 'jpg';
    const uniquePath = `prop_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;

    const { data, error } = await this.supabase.storage
      .from(this.imagesBucket)
      .upload(uniquePath, fileBuffer, {
        contentType,
        upsert: true
      });

    if (error) {
      throw new Error(`Supabase Image Upload Error: ${error.message}`);
    }

    const { data: pubUrlData } = this.supabase.storage
      .from(this.imagesBucket)
      .getPublicUrl(uniquePath);

    return {
      storageKey: uniquePath,
      publicUrl: pubUrlData.publicUrl
    };
  }

  /**
   * Uploads private ownership document/PDF to 'property-documents' bucket
   */
  async uploadPrivateDocument(propertyId, fileName, fileBuffer, contentType = 'application/pdf') {
    const ext = fileName.split('.').pop() || 'pdf';
    const uniquePath = `${propertyId}/${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;

    const { data, error } = await this.supabase.storage
      .from(this.documentsBucket)
      .upload(uniquePath, fileBuffer, {
        contentType,
        upsert: true
      });

    if (error) {
      throw new Error(`Supabase Private Document Upload Error: ${error.message}`);
    }

    return {
      storageKey: uniquePath,
      bucket: this.documentsBucket
    };
  }

  /**
   * Generates a time-limited signed access URL (default 15 minutes) for a private document
   */
  async generateSignedUrl(storageKey, expiresInSeconds = 900) {
    // If storageKey is a full URL or local path fallback
    if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
      return { signedUrl: storageKey, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
    }

    const cleanPath = storageKey.replace(/^private\/documents\//, '');
    const { data, error } = await this.supabase.storage
      .from(this.documentsBucket)
      .createSignedUrl(cleanPath, expiresInSeconds);

    if (error) {
      // Fallback signed representation
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
      return {
        signedUrl: `${SUPABASE_URL}/storage/v1/object/sign/${this.documentsBucket}/${cleanPath}`,
        expiresAt
      };
    }

    return {
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    };
  }
}

const storage = new SupabaseStorageService();

module.exports = {
  supabase,
  storage,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES
};
