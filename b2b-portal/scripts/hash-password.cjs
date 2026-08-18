#!/usr/bin/env node
/**
 * Hash a password for sql/007_seed_platform_admin.sql
 * Usage: npm run hash-password -- "your-password"
 */
const bcrypt = require("bcryptjs");

const plain = process.argv[2];
if (!plain) {
  console.error("Usage: npm run hash-password -- \"your-password\"");
  process.exit(1);
}

bcrypt.hash(plain, 12).then((hash) => {
  console.log(hash);
});
