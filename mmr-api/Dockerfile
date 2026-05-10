ARG GO_VERSION=1
FROM golang:${GO_VERSION}-bookworm AS builder

WORKDIR /usr/src/app
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /run-app .


FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /run-app /run-app
ENTRYPOINT ["/run-app"]
