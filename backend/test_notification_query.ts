
import mongoose from 'mongoose';
import Notification from './src/models/Notification';
import dotenv from 'dotenv';
import path from 'path';
import Admin from './src/models/Admin'; // Ensure Admin is registered

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/geeta-ecom';

async function test() {
  try {
    console.log('Connecting to DB:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected.');

    const query: any = {};
    query.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gte: new Date() } },
    ];

    console.log('Querying Notifications...');
    const limit = 10;
    const skip = 0;

    // Explicitly testing populate
    const notifications = await Notification.find(query)
        .populate("createdBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    console.log(`✅ Found ${notifications.length} notifications.`);
    if (notifications.length > 0) {
        console.log('Sample:', JSON.stringify(notifications[0], null, 2));
    }

    const count = await Notification.countDocuments(query);
    console.log(`✅ Total count: ${count}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

test();
