.PHONY: serve build clean deploy help

# Development server with live reload
serve:
	@echo "🚀 Starting development server with live reload..."
	@uv run mkdocs serve --livereload

# Build documentation
build:
	@echo "📦 Building documentation..."
	@uv run mkdocs build

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	@uv run mkdocs build --clean

# Show help
help:
	@echo "Available commands:"
	@echo "  make serve   - Start development server"
	@echo "  make build   - Build documentation"
	@echo "  make clean   - Clean build artifacts"
