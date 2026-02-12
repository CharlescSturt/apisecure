# Contributing to APISecure

Thank you for your interest in contributing to APISecure! We welcome contributions from the community.

## How to Contribute

### Reporting Issues

If you find a bug or have a suggestion:

1. Check if the issue already exists in our [issue tracker](https://github.com/CharlescSturt/apisecure/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Screenshots if applicable

### Submitting Changes

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** with clear, focused commits
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Submit a pull request** with a clear description

### Pull Request Guidelines

- Keep changes focused and atomic
- Follow existing code style
- Add tests for new features
- Update README.md if applicable
- Ensure all tests pass

### Code Style

- Use consistent indentation (2 spaces)
- Write clear, self-documenting code
- Add comments for complex logic
- Keep functions small and focused

### Security Contributions

If you discover a security vulnerability:
- **DO NOT** open a public issue
- Email us directly at: security@skillshield.dev
- We'll respond within 48 hours

## Development Setup

```bash
# Clone the repository
git clone https://github.com/CharlescSturt/apisecure.git
cd apisecure

# Install dependencies (for development tools)
npm install

# Start development server
npm run dev

# Or use a simple HTTP server for static files
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## Project Structure

```
apisecure/
├── index.html          # Main landing page
├── encrypt.html        # Encryption interface
├── decrypt.html        # Decryption interface (NEW)
├── docs.html           # Documentation page
├── blog/               # Blog articles (NEW)
│   ├── index.html
│   └── secure-api-key-sharing.html
├── app/                # Future app features
├── README.md           # Project documentation
├── CONTRIBUTING.md     # This file
├── CHANGELOG.md        # Version history (NEW)
└── CODE_OF_CONDUCT.md  # Community guidelines
```

## Testing Changes

When making changes to encryption/decryption:

1. **Test encrypt.html** - Encrypt a sample API key
2. **Test decrypt.html** - Decrypt using the generated URL
3. **Verify format version** - Ensure version 2 compatibility
4. **Test with large keys** - Try keys >8KB to verify Base64 handling
5. **Check browser compatibility** - Test on Chrome, Firefox, Safari

## Questions?

Feel free to open an issue for questions or reach out on Twitter [@charlescsturt](https://twitter.com/charlescsturt)

Thank you for helping make API key sharing safer! 🔐
