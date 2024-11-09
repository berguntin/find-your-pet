package api

import (
	"backend/pets"
	"errors"
	"github.com/gin-gonic/gin"
	"log"
	"net/http"
)

func Get(repo pets.Repository) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		pet, err := repo.Get(id)
		if errors.Is(err, pets.ErrPetNotFound) {
			c.IndentedJSON(http.StatusNotFound, gin.H{"success": false, "message": "Pet not found"})
			return
		}
		if err != nil {
			log.Printf("Error getting pet by id %s: %v\n", err)
			c.IndentedJSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Please try again later"})
			return

		}

		c.IndentedJSON(http.StatusOK, pet)
	}
}
