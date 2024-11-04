import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

export const uploadImages = async (files) => {
    
    return await Promise.all(
        files.map(file => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'image',
                        folder: 'pets',
                        transformation: [
                            { width: 800, height: 600, crop: "limit" },
                            { quality: "auto" }, 
                            { fetch_format: "auto" }
                        ]
                    },
                    (error, result) => {
                        if (error) {
                            return reject(error);
                        }
                        resolve(result.secure_url); 
                    }
                );
                stream.end(file.buffer);
            });
        })
    );
};