import { describe, expect, it, vi } from 'vitest';

// part-photo pulls in expo-image-picker and the Supabase client; only the pure
// path/URI logic is under test here.
vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
  requestCameraPermissionsAsync: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: vi.fn() } } }));
vi.mock('@/lib/demo', () => ({ isDemoMode: () => false }));

const { isLocalUri, photoPath } = await import('@/lib/part-photo');

describe('photoPath', () => {
  it('namespaces by part so one part cannot overwrite another', () => {
    expect(photoPath('part-1', 'image/jpeg', 1700)).toBe('part-1/1700.jpeg');
  });

  it('uses a new object name per upload', () => {
    // Replacing a photo must not reuse the key: a CDN or client holding the old
    // signed URL would keep serving the previous image.
    expect(photoPath('p', 'image/jpeg', 1)).not.toBe(photoPath('p', 'image/jpeg', 2));
  });

  it('takes the extension from the mime type', () => {
    expect(photoPath('p', 'image/png', 5)).toBe('p/5.png');
    expect(photoPath('p', 'image/webp', 5)).toBe('p/5.webp');
  });

  it('falls back to jpg for a missing or odd mime type', () => {
    expect(photoPath('p', '', 5)).toBe('p/5.jpg');
    expect(photoPath('p', 'image', 5)).toBe('p/5.jpg');
  });

  it('strips anything unsafe out of the extension', () => {
    // "image/jpeg; charset=..." must not produce a path with punctuation.
    expect(photoPath('p', 'image/jpeg;charset=binary', 5)).toBe('p/5.jpegcharsetbinary');
  });
});

describe('isLocalUri', () => {
  it('recognises renderable URIs', () => {
    for (const uri of [
      'file:///var/mobile/photo.jpg',
      'ph://ABC-123',
      'content://media/external/images/1',
      'https://example.com/a.jpg',
      'data:image/png;base64,AAAA',
    ]) {
      expect(isLocalUri(uri)).toBe(true);
    }
  });

  it('treats bucket paths as needing a signature', () => {
    expect(isLocalUri('part-1/1700.jpeg')).toBe(false);
    expect(isLocalUri('nested/dir/file.png')).toBe(false);
  });
});
