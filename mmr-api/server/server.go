package server

import "os"

func Init() {
	router := NewRouter()
	port := os.Getenv("MMR_API_PORT")
	if port == "" {
		port = "8080"
	}
	router.Run(":" + port)
}
