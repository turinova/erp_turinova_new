import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import type { ShopCredentialsPlain } from "@/types/db";

/**
 * AES-256-GCM for shop_credentials at rest.
 * Key: CREDENTIALS_ENCRYPTION_KEY = 64 hex chars (32 bytes).
 *   openssl rand -hex 32
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function getKey(): Buffer {
  const hex = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32)",
    );
  }
  return Buffer.from(hex, "hex");
}

export type EncryptedBlob = {
  ciphertext: Buffer;
  iv: Buffer;
  key_version: number;
};

export function encryptCredentials(
  plain: ShopCredentialsPlain,
  keyVersion = 1,
): EncryptedBlob {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const json = Buffer.from(JSON.stringify(plain), "utf8");
  const enc = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store ciphertext || authTag
  return {
    ciphertext: Buffer.concat([enc, tag]),
    iv,
    key_version: keyVersion,
  };
}

export function decryptCredentials(
  blob: EncryptedBlob,
): ShopCredentialsPlain {
  const key = getKey();
  if (blob.ciphertext.length < 17) {
    throw new Error("Invalid ciphertext");
  }
  const tag = blob.ciphertext.subarray(blob.ciphertext.length - 16);
  const data = blob.ciphertext.subarray(0, blob.ciphertext.length - 16);
  const decipher = createDecipheriv(ALGO, key, blob.iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
  return JSON.parse(json) as ShopCredentialsPlain;
}
