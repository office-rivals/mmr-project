package main

import (
	_ "ariga.io/atlas-provider-gorm/gormschema"
	"mmr/backend/config"
)

import (
	server "mmr/backend/server"
)

// @BasePath	/api

func main() {
	config.LoadEnv()
	//database.Init()
	server.Init()
}
