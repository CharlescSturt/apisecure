# Changelog

All notable changes to APISecure will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Browser-based decryption page** (`decrypt.html`) - Users can now decrypt keys directly in their browser without Node.js or CLI tools
- **Blog section** with SEO-optimized security articles at `/blog/`
- **Open Graph image** for better social media sharing (og-image.png)
- **Updated branding** with new logo and favicon files
  - favicon.ico
  - favicon-32x32.png
  - apple-touch-icon.png
  - logo-192.png and logo-512.png
- **Format version 2** for encryption/decryption to support large API keys
- **Browser compatibility section** in documentation
- **Direct links** to encrypt/decrypt pages in navigation

### Fixed
- **Format version mismatch** - Browser decryption now uses version 2 to match the encrypt skill and decrypt.html implementation
- **Base64 encoding stack overflow** bug when handling large API keys (improved chunked encoding)
- **URL routing** - All documentation links now consistently point to apisecure.app domain

### Changed
- **Improved encryption handling** for large payloads with optimized Base64 encoding
- **Enhanced UI/UX** with cyberpunk-inspired design and better visual feedback
- **Updated documentation** to reflect browser-based workflow

## [1.0.0] - 2024-02-11

### Added
- Initial release of APISecure
- AES-256-GCM encryption in browser
- Zero-server architecture
- Share API keys via URL
- PBKDF2 key derivation (100k rounds)
- Configurable expiration
- Mobile-responsive design
- Security documentation

### Security
- Implemented Web Crypto API for encryption
- Zero-knowledge architecture (no server-side key storage)
- HTTPS/TLS 1.3 for transport security

---

## Release Notes

### Version 2.0 Features

The latest updates focus on **accessibility** and **reliability**:

1. **No CLI Required**: Users can now decrypt keys directly at `apisecure.app/decrypt.html` without installing Node.js or command-line tools
2. **Large Key Support**: Fixed Base64 encoding issues that caused stack overflows with large API keys (>8KB)
3. **Version Consistency**: All encryption/decryption tools now use format version 2 for compatibility
4. **Better Branding**: Professional logo and favicon for improved recognition
5. **SEO & Sharing**: Blog section and Open Graph images for better discoverability

These changes make APISecure more accessible to non-technical users while maintaining the same security standards.
