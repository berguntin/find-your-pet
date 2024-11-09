FROM golang:latest AS development
WORKDIR /app

RUN go install github.com/air-verse/air@latest
ENTRYPOINT ["air", "-d", "--build.cmd", "go build -o bin/api main.go", "--build.bin", "./bin/api", "--tmp_dir", "./tmp"]