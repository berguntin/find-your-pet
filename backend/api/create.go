package api

import (
	"backend/pets"
	"github.com/gin-gonic/gin"
	"log"
	"net/http"
)

func Create(repo pets.Repository) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Type        string `form:"type"`
			Description string `form:"description"`
			Name        string `form:"name"`
			Status      string `form:"status"`
			Location    string `form:"location"`
			Alive       bool   `form:"alive"`
			Contact     string `form:"contact"`
			Date        string `form:"date"`
		}

		err := c.ShouldBind(&req)
		if err != nil {
			log.Fatalf("error invalid request %s", err)
		}

		imgs := pets.Images{"https://upload.wikimedia.org/wikipedia/commons/3/3b/BlkStdSchnauzer2.jpg"} // fixme save uploaded files to storage
		err = repo.Create(pets.Pet{
			Type:        req.Type,
			Images:      imgs,
			Description: req.Description,
			Name:        req.Name,
			Status:      req.Status,
			Location:    req.Location,
			Alive:       req.Alive,
			Contact:     req.Contact,
			Date:        req.Date,
		})
		if err != nil {
			log.Printf("Error creating pet: %v\n", err)
			c.IndentedJSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Please try again later"})
		}

		c.IndentedJSON(http.StatusCreated, gin.H{"success": true, "message": "Pet created successfully"})
	}
}
