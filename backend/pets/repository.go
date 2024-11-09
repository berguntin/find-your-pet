package pets

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

var ErrPetNotFound = errors.New("pet not found")

type Images []string

func (i Images) Value() (driver.Value, error) {
	if len(i) == 0 {
		return "[]", nil
	}
	return fmt.Sprintf(`["%s"]`, strings.Join(i, `","`)), nil
}

func (i *Images) Scan(src interface{}) (err error) {
	var images []string
	switch src.(type) {
	case string:
		err = json.Unmarshal([]byte(src.(string)), &images)
	case []byte:
		err = json.Unmarshal(src.([]byte), &images)
	default:
		return errors.New("Incompatible type for Images")
	}
	if err != nil {
		return
	}
	*i = images
	return nil
}

type Pet struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Images      Images `json:"images"`
	Description string `json:"description"`
	Name        string `json:"name"`
	Status      string `json:"status"`
	Location    string `json:"location"`
	Alive       bool   `json:"alive"`
	Contact     string `json:"contact"`
	Date        string `json:"date"`
	AtHome      bool   `json:"athome"`
	CreatedBy   string `json:"created_by"`
	CreatedAt   string `json:"created_at"`
}

type UpdatePet struct {
	ID     string
	AtHome *bool
}

type Repository interface {
	GetAll() ([]Pet, error)
	Create(Pet) error
	Get(id string) (*Pet, error)
	Delete(id string) error
	Update(pet UpdatePet) error
}
