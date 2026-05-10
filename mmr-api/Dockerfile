ARG GO_VERSION=1
FROM golang:${GO_VERSION}-bookworm AS builder

ARG VERSION=dev

WORKDIR /usr/src/app
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" -o /run-app .


FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /run-app /run-app
ENTRYPOINT ["/run-app"]
