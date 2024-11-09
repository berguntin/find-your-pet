package api

import (
	"backend/pets"
	"errors"
	"github.com/gin-gonic/gin"
	"log"
	"net/http"
)

func Update(repo pets.Repository) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			AtHome bool `json:"athome"`
		}
		err := c.ShouldBindJSON(&req)
		if err != nil {
			log.Printf("Error parsing update pet request: %v\n", err)
			c.IndentedJSON(http.StatusBadRequest, gin.H{"success": false, "message": "Please try again later"})
			return
		}

		err = repo.Update(pets.UpdatePet{
			ID:     c.Param("id"),
			AtHome: &req.AtHome,
		})
		if errors.Is(err, pets.ErrPetNotFound) {
			c.IndentedJSON(http.StatusNotFound, gin.H{"success": false, "message": "Pet not found"})
			return
		}
		if err != nil {
			log.Printf("Error updating pet: %v\n", err)
			c.IndentedJSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Please try again later"})
			return
		}

		c.IndentedJSON(http.StatusOK, gin.H{"success": true, "message": "Pet updated successfully"})
	}
}
