package main

import (
	"backend/api"
	"backend/pets"
	"database/sql"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

func getConnection() (*sql.DB, error) {
	uri := "postgres://postgres:foobar@db:5432/pets?sslmode=disable" // fixme configuration
	return sql.Open("postgres", uri)
}

func main() {
	var repo pets.Repository
	{
		db, err := getConnection()
		if err != nil {
			log.Fatalf("couldn't connect with database %v", err)
		}

		repo = pets.DBRepository{DB: db}
	}

	router := gin.Default()
	router.Use(cors.Default())

	router.GET("/api/pets", api.Find(repo))
	router.POST("/api/pets", api.Create(repo))
	router.GET("/api/pets/:id", api.Get(repo))
	router.PUT("/api/pets/:id", api.Update(repo))
	router.DELETE("/api/pets/:id", api.Delete(repo))

	router.Run(":3000")
}
