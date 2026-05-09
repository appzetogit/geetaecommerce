const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/geetaecommerce';

async function findProduct() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const products = await db.collection('products').find({
            name: { $regex: /Vasline daily brightening 90 ml 125/i }
        }).toArray();

        console.log('Found Products:', JSON.stringify(products, null, 2));

        // Also check seller products (inventory)
        const sellerProducts = await db.collection('sellerproducts').find({
            $or: [
                { name: { $regex: /Vasline daily brightening 90 ml 125/i } },
                { productName: { $regex: /Vasline daily brightening 90 ml 125/i } }
            ]
        }).toArray();

        console.log('Found Seller Products:', JSON.stringify(sellerProducts, null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

findProduct();
