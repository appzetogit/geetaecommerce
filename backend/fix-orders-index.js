// Quick script to fix MongoDB duplicate key error
// Run with: node fix-orders-index.js

const mongoose = require('mongoose');
require('dotenv').config();

async function fixOrdersIndex() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const ordersCollection = db.collection('orders');

        // Step 1: Delete any orders with null orderId
        const deleteResult = await ordersCollection.deleteMany({ orderId: null });
        console.log(`🗑️  Deleted ${deleteResult.deletedCount} orders with null orderId`);

        // Step 2: Try to drop the problematic index
        try {
            await ordersCollection.dropIndex('orderId_1');
            console.log('✅ Dropped orderId_1 index');
        } catch (err) {
            console.log('ℹ️  Index might not exist or already dropped');
        }

        // Step 3: Recreate the index if needed (optional - Mongoose will handle this)
        // await ordersCollection.createIndex({ orderId: 1 }, { unique: true, sparse: true });

        console.log('✅ Database cleanup complete!');
        console.log('✨ You can now place orders successfully');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixOrdersIndex();
