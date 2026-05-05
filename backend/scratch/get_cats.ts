import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Category from '../src/models/Category';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const cats = await Category.find().select('name parentId').lean();
  console.log(JSON.stringify(cats, null, 2));
  process.exit(0);
}
run();
