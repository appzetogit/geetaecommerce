import mongoose from 'mongoose';
import Product from './src/models/Product';

const MURI = 'mongodb+srv://aryankarma29_db_user:iR1609zqHSZRxUDx@cluster0.fi6wvqa.mongodb.net/geeta-ecom';

async function check() {
  try {
    await mongoose.connect(MURI);
    console.log('Connected');
    
    // Find categories with "file" in name
    const count = await Product.countDocuments({ productName: { $regex: /file/i } });
    console.log(`\nFound ${count} products with "file" in name.`);

    const samples = await Product.find({ productName: { $regex: /file/i } })
      .limit(10)
      .select('productName category subcategory');
    
    console.log('\nSample Files in DB:');
    samples.forEach(s => {
      console.log(`- ${s.productName} (Cat: ${s.category}, Subcat: ${s.subcategory})`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
