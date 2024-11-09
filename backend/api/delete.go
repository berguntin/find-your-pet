package api

import (
	"backend/pets"
	"github.com/gin-gonic/gin"
	"log"
	"net/http"
)

func Delete(repo pets.Repository) gin.HandlerFunc {
	return func(c *gin.Context) {
		err := repo.Delete(c.Param("id"))
		if err != nil {
			log.Printf("Error deleting pet: %v\n", err)
			c.IndentedJSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Please try again later"})
			return
		}
		c.IndentedJSON(http.StatusOK, gin.H{"success": true, "message": "Pet deleted successfully"})
	}
}
