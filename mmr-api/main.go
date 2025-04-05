package main

import (
	"mmr/backend/config"
)

import (
	server "mmr/backend/server"
)

// @BasePath	/api

func main() {
	config.LoadEnv()
	server.Init()
}
