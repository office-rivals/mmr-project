package config

import (
	"github.com/caarlos0/env/v6"
	"github.com/joho/godotenv"
	"log"
)

type Config struct {
	//DBHost      string `env:"DB_HOST,required"`
	//DBUser      string `env:"DB_USER,required"`
	//DBPassword  string `env:"DB_PASSWORD,required"`
	//DBName      string `env:"DB_NAME,required"`
	//DBPort      int    `env:"DB_PORT" envDefault:"5432"`
	//DBSSLMode   string `env:"DB_SSLMODE" envDefault:"disable"`
	//JWTSecret   string `env:"JWT_SECRET,required"`
	AdminSecret string `env:"ADMIN_SECRET,required"`
}

func LoadEnv() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Did not load any .env file")
	}

	cfg := Config{}
	err = env.Parse(&cfg)
	if err != nil {
		log.Fatalf("unable to parse ennvironment variables: %s", err.Error())
	}
}
