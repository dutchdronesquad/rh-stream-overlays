.PHONY: serve build clean deploy help

# Development server with live reload
serve:
	@echo "🚀 Starting development server with live reload..."
	@uv run zensical serve

# Build documentation
build:
	@echo "📦 Building documentation..."
	@uv run zensical build

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	@uv run zensical build --clean

# Show help
help:
	@echo "Available commands:"
	@echo "  make serve   - Start development server"
	@echo "  make build   - Build documentation"
	@echo "  make clean   - Clean build artifacts"
