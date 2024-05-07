package database

import (
	"mmr/backend/db/models"
	"os"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init() {
	// Define the database configuration
	db, err := gorm.Open(sqlite.Open(os.Getenv("DATABASE_URL")), &gorm.Config{})
	if err != nil {
		panic("failed to connect to database")
	}

	// Auto Migrate your models
	err = db.AutoMigrate(&models.User{}, &models.Team{}, &models.Match{})
	if err != nil {
		panic("failed to auto migrate models")
	}

	// Assign the database connection to the global variable
	DB = db
}
