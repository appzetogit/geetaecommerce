const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

const findProducts = async () => {
    await connectDB();
    try {
        const Product = mongoose.connection.collection('products');
        const products = await Product.find({
            $or: [
                { productName: /epson/i },
                { productName: /057/i },
                { productName: /789/i }
            ]
        }).toArray();

        console.log(`Found ${products.length} products:`);
        products.forEach(p => {
            console.log(`Name: ${p.productName}`);
            console.log(`ID: ${p._id.toString()}`);
            console.log(`pack: ${p.pack}`);
            console.log(`stock: ${p.stock}`);
            console.log(`variations: ${JSON.stringify(p.variations)}`);
            console.log('-------------------');
        });
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

findProducts();
