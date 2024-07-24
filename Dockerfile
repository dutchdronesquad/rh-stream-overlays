# Gebruik een officiële Python runtime als basisimage
FROM python:3.12-slim

# Stel de werkdirectory in
WORKDIR /app

# Installeer curl en andere noodzakelijke pakketten
RUN apt-get update && apt-get install -y curl git

# Installeer Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -

# Voeg Poetry toe aan de PATH
ENV PATH="/root/.local/bin:$PATH"

# Kopieer de projectbestanden naar de werkdirectory
COPY . .

# Installeer de dependencies met Poetry
RUN poetry install

# Build de MkDocs site
RUN poetry run mkdocs build

# Geef de build directory op als Vercel output
CMD ["cp", "-r", "site", "/vercel/output"]