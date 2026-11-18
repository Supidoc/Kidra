# syntax=docker/dockerfile:1
#
# Kidra container image.
#
# Targets:
#   full (default, last stage)  kidra + kicad-cli, based on the official kicad/kicad image
#   slim                        kidra only (distroless, no kicad-cli: no SVG previews)
#   web / gobuild               intermediate build stages
#
# Build args:
#   VERSION, COMMIT   injected into the binary via -ldflags (main.version / main.commit)
#   SOURCE_URL        org.opencontainers.image.source label
#   GO_TAGS           Go build tags (default "embedui": embed backend/ui/dist into the binary)
#   KICAD_IMAGE       base image of the full target (tag@digest; bumps are manual)
#   KICAD_VERSION     value of the org.kidra.kicad.version label; keep in sync with KICAD_IMAGE
#
#   docker build -t kidra:local .
#   docker build --target slim -t kidra:local-slim .

ARG KICAD_IMAGE=kicad/kicad:10.0.8@sha256:3f4a01786dfbe803a65f345c3342b765db9add913f5e9448f8356793714ddc34

# ---------------------------------------------------------------------------
# web: build the SvelteKit SPA into /src/backend/ui/dist
# ---------------------------------------------------------------------------
FROM node:26-trixie AS web
# Node 25+ no longer ships corepack, so pnpm comes from npm (version = package.json packageManager).
RUN npm install -g pnpm@12.15.0
WORKDIR /src/frontend
# Dependency layer: only the manifests, the lockfile and the patches it references.
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml frontend/.npmrc ./
COPY frontend/patches ./patches
RUN --mount=type=cache,id=kidra-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store --package-import-method copy
COPY frontend/ ./
# The adapter writes to ../backend/ui/dist (see vite.config.ts).
RUN pnpm build && test -f /src/backend/ui/dist/index.html

# ---------------------------------------------------------------------------
# gobuild: static Go binary with the SPA embedded
# ---------------------------------------------------------------------------
FROM golang:1.27-trixie AS gobuild
WORKDIR /src/backend
ENV CGO_ENABLED=0
# Module layer (third_party is a `replace` target, so it must be present for go mod download).
COPY backend/go.mod backend/go.sum ./
COPY backend/third_party ./third_party
RUN --mount=type=cache,id=kidra-gomod,target=/go/pkg/mod \
    go mod download
COPY backend/ ./
COPY --from=web /src/backend/ui/dist ./ui/dist
ARG GO_TAGS=embedui
ARG VERSION=dev
ARG COMMIT=unknown
RUN --mount=type=cache,id=kidra-gomod,target=/go/pkg/mod \
    --mount=type=cache,id=kidra-gobuild,target=/root/.cache/go-build \
    go build -tags "${GO_TAGS}" -trimpath \
      -ldflags "-s -w -X main.version=${VERSION} -X main.commit=${COMMIT}" \
      -o /out/kidra . \
 && mkdir -p /out/pb_data

# ---------------------------------------------------------------------------
# slim: distroless, no kicad-cli
# ---------------------------------------------------------------------------
FROM gcr.io/distroless/static-debian13 AS slim
ARG VERSION=dev
ARG COMMIT=unknown
ARG SOURCE_URL=https://github.com/Supidoc/Kidra
LABEL org.opencontainers.image.title="kidra-slim" \
      org.opencontainers.image.description="Kidra KiCad library manager (without kicad-cli)" \
      org.opencontainers.image.source="${SOURCE_URL}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT}"
ENV KIDRA_MIGRATIONS_DIR=/app/pb_migrations
# /pb_data is created in a build stage so it is owned by (and writable for) uid 1000.
COPY --from=gobuild --chown=1000:1000 /out/pb_data /pb_data
COPY backend/pb_migrations /app/pb_migrations
COPY --from=gobuild /out/kidra /app/kidra
USER 1000:1000
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["/app/kidra", "health"]
ENTRYPOINT ["/app/kidra"]
CMD ["serve", "--http=0.0.0.0:8090", "--dir=/pb_data"]

# ---------------------------------------------------------------------------
# full (default): official KiCad image (Debian trixie, user kicad uid 1000,
# stock symbol/footprint libraries, no 3D models) + kidra
# ---------------------------------------------------------------------------
FROM ${KICAD_IMAGE} AS full
USER root
# Drop the base image's passwordless sudo (sudo refuses removal without a root
# password unless SUDO_FORCE_REMOVE=yes); create the data and app dirs.
RUN sed -i '/^%sudo[[:space:]]\+ALL=(ALL)[[:space:]]\+NOPASSWD:[[:space:]]*ALL$/d' /etc/sudoers \
 && gpasswd -d kicad sudo \
 && SUDO_FORCE_REMOVE=yes apt-get purge -y --auto-remove sudo \
 && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*.deb \
 && mkdir -p /pb_data /app \
 && chown kicad:kicad /pb_data
ENV KIDRA_KICAD_CLI=/usr/bin/kicad-cli \
    KIDRA_KICAD_STOCK_3DMODEL_DIR=/kicad-3dmodels \
    KIDRA_MIGRATIONS_DIR=/app/pb_migrations
# Thin kidra layers last, so the ~3.5 GB base stays shared between releases.
COPY backend/pb_migrations /app/pb_migrations
COPY --from=gobuild /out/kidra /app/kidra
ARG VERSION=dev
ARG COMMIT=unknown
ARG SOURCE_URL=https://github.com/Supidoc/Kidra
ARG KICAD_VERSION=10.0.8
# Overrides the inherited KiCad labels (licenses, authors, url, ...) that do not describe kidra.
LABEL org.opencontainers.image.title="kidra" \
      org.opencontainers.image.description="Kidra KiCad library manager (with kicad-cli)" \
      org.opencontainers.image.source="${SOURCE_URL}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT}" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.authors="" \
      org.opencontainers.image.documentation="${SOURCE_URL}" \
      org.opencontainers.image.url="${SOURCE_URL}" \
      org.opencontainers.image.vendor="" \
      org.kidra.kicad.version="${KICAD_VERSION}"
USER kicad
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["/app/kidra", "health"]
ENTRYPOINT ["/app/kidra"]
CMD ["serve", "--http=0.0.0.0:8090", "--dir=/pb_data"]
