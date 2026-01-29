import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Shop from '../src/models/Shop';

dotenv.config();

async function checkShops() {
  try {
    await mongoose.connect(process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || '');
    console.log('Connected to DB');
    const shops = await Shop.find({});
    console.log('Total Shops:', shops.length);
    console.log('Shops:', JSON.stringify(shops, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkShops();
