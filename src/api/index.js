
export const savePet = async (data) => {
    
    const response = await fetch( `${import.meta.env.VITE_API_URL}`, {
        method: 'POST',
        body: data
    })

    return response
}

export const getList = async () => {
    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}`, {
            method: 'GET'
        });

       
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error; 
    }
}

export const setAtHome = async (petId) => {
    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/${petId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ athome: true })
        });

        if (!response.ok) {
            throw new Error('Error en la solicitud');
        }

        return await response.json(); 
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};
