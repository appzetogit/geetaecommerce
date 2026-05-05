import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Category from '../src/models/Category';
import SubCategory from '../src/models/SubCategory';
import Product from '../src/models/Product';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function inspect() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const categories = await Category.find({ status: 'Active' }).select('name _id parentId').lean();
    console.log(`Found ${categories.length} active categories`);

    const subCategories = await SubCategory.find().select('name _id category').lean();
    console.log(`Found ${subCategories.length} subcategories`);

    const productsCount = await Product.countDocuments();
    console.log(`Total products: ${productsCount}`);

    const sampleProducts = await Product.find({ status: 'Active' })
      .select('productName category subcategory')
      .limit(20)
      .lean();

    console.log('\nSample Products:');
    sampleProducts.forEach(p => {
      console.log(`- ${p.productName} (Cat ID: ${p.category}, SubCat ID: ${p.subcategory})`);
    });

    console.log('\nCategories List:');
    categories.filter(c => !c.parentId).forEach(c => {
      console.log(`[Main] ${c.name} (${c._id})`);
      categories.filter(sub => sub.parentId?.toString() === c._id.toString()).forEach(sub => {
        console.log(`  [Child] ${sub.name} (${sub._id})`);
      });
    });

    console.log('\nLegacy SubCategories List:');
    subCategories.forEach(s => {
      console.log(`- ${s.name} (${s._id}) -> Parent Cat: ${s.category}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspect();
