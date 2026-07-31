/**
 * EventFlow — Portal del Cliente: Tests unitarios (WP-25)
 * 
 * Tests para la lógica de dominio del portal:
 * - Generación y hash de tokens
 * - Creación y resolución de portales
 * - Magic links
 * - Restricciones de acceso
 */

import { describe, it, expect } from 'vitest';
import { generateAccessToken, hashToken } from '../src/domain/portal';

describe('Portal Token Utils', () => {
  describe('generateAccessToken', () => {
    it('should generate a token of at least 32 bytes (64 hex chars)', () => {
      const token = generateAccessToken();
      expect(token.length).toBeGreaterThanOrEqual(64);
    });

    it('should generate unique tokens', () => {
      const token1 = generateAccessToken();
      const token2 = generateAccessToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate hex-encoded tokens', () => {
      const token = generateAccessToken();
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('should respect custom length', () => {
      const token = generateAccessToken(32);
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    });
  });

  describe('hashToken', () => {
    it('should produce a 64-character hex hash', () => {
      const token = generateAccessToken();
      const hash = hashToken(token);
      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should be deterministic', () => {
      const token = 'test-token-123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token-1');
      const hash2 = hashToken('token-2');
      expect(hash1).not.toBe(hash2);
    });

    it('should match known SHA-256 hash', () => {
      // SHA-256 of "hello" = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
      const hash = hashToken('hello');
      expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });
  });
});

describe('Portal Security', () => {
  it('tokens should have sufficient entropy', () => {
    // Generate 100 tokens and verify no duplicates
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateAccessToken());
    }
    expect(tokens.size).toBe(100);
  });

  it('hash should be one-way (cannot recover token from hash)', () => {
    const token = generateAccessToken();
    const hash = hashToken(token);
    
    // The hash should not contain the original token
    expect(hash).not.toContain(token);
    
    // The hash should be a fixed length regardless of input
    const longToken = 'a'.repeat(1000);
    const longHash = hashToken(longToken);
    expect(longHash.length).toBe(64);
  });
});
