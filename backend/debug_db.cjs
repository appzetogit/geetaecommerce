
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/Geeta Stores');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const run = async () => {
    await connectDB();

    console.log("Searching for 'Vegetables'...");

    // Check Categories
    const categories = await mongoose.connection.db.collection('categories').find({
        name: { $regex: /Vegetable/i }
    }).toArray();

    console.log("\n--- Categories Found ---");
    categories.forEach(cat => {
        console.log(`ID: ${cat._id}`);
        console.log(`Name: ${cat.name}`);
        console.log(`Slug: ${cat.slug}`);
        console.log(`Status: ${cat.status}`);
        console.log("------------------------");
    });

    if (categories.length > 0) {
        // Check SubCategories for these categories
        const catIds = categories.map(c => c._id);
        const subs = await mongoose.connection.db.collection('subcategories').find({
            category: { $in: catIds }
        }).toArray();

        console.log("\n--- SubCategories Found ---");
        subs.forEach(sub => {
            console.log(`ID: ${sub._id}`);
            console.log(`Name: ${sub.name}`);
            console.log(`Category ID: ${sub.category}`);
            console.log("------------------------");
        });
    } else {
        console.log("No categories found matching 'Vegetable'");
    }

    process.exit();
};

run();
