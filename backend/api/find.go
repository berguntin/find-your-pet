package api

import (
	"backend/pets"
	"github.com/gin-gonic/gin"
	"log"
	"net/http"
)

func Find(repo pets.Repository) gin.HandlerFunc {
	return func(c *gin.Context) {
		pets, err := repo.GetAll()
		if err != nil {
			log.Printf("Error getting pets: %v\n", err)
			c.IndentedJSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Please try again later"})
			return
		}

		c.IndentedJSON(http.StatusOK, pets)
	}
}
