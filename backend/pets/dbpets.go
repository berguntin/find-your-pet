package pets

import (
	"database/sql"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"time"
)

type DBRepository struct {
	DB *sql.DB
}

func (r DBRepository) GetAll() ([]Pet, error) {
	rows, err := r.DB.Query("SELECT id, type, images, description, name, status, location, alive, contact, date, atHome, created_by, created_at FROM pets")
	if err != nil {
		return nil, fmt.Errorf("unexpected error getting pets: %v", err)
	}
	defer rows.Close()

	pets := make([]Pet, 0) // todo check count
	for rows.Next() {
		var p Pet
		var imgs Images

		if err = rows.Scan(&p.ID, &p.Type, &imgs, &p.Description, &p.Name, &p.Status, &p.Location, &p.Alive, &p.Contact, &p.Date, &p.AtHome, &p.CreatedBy, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("unexpected error parsing pets data: %v", err)
		}
		p.Images = imgs

		pets = append(pets, p)
	}

	return pets, nil
}

func (r DBRepository) Delete(id string) error {
	_, err := r.DB.Exec("DELETE FROM pets WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("unexpected error deleting pet %s: %v", id, err)
	}
	// todo remove images

	return nil
}

func (r DBRepository) Create(pet Pet) error {
	_, err := r.DB.Exec(
		"INSERT INTO pets(id, type, images, description, name, status, location, alive, contact, date, atHome, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
		uuid.New(), pet.Type, pet.Images, pet.Description, pet.Name, pet.Status, pet.Location, pet.Alive, pet.Contact, pet.Date, false, "web", time.Now().Format(time.RFC3339),
	)
	if err != nil {
		return fmt.Errorf("unexpected error creating pet: %v", err)
	}

	return nil
}

func (r DBRepository) Get(id string) (*Pet, error) {
	row := r.DB.QueryRow("SELECT id, type, images, description, name, status, location, alive, contact, date, atHome, created_by, created_at FROM pets WHERE id = $1", id)

	var p Pet
	if err := row.Scan(&p.ID, &p.Type, &p.Images, &p.Description, &p.Name, &p.Status, &p.Location, &p.Alive, &p.Contact, &p.Date, &p.AtHome, &p.CreatedBy, &p.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrPetNotFound
		}
		return nil, fmt.Errorf("unexpected error getting pet: %v", err)
	}
	return &p, nil
}

func (r DBRepository) Update(new UpdatePet) error {
	if new.AtHome == nil {
		return nil // nothing to do
	}

	res, err := r.DB.Exec("UPDATE pets SET atHome = $1 WHERE id = $2", new.AtHome, new.ID)
	if err != nil {
		return fmt.Errorf("unexpected error updating pet: %v", err)
	}

	count, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("unexpected error updating pet: %v", err)
	}
	if count == 0 {
		return ErrPetNotFound
	}

	return nil
}
