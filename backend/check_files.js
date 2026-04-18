const mongoose = require('mongoose');

const MURI = 'mongodb+srv://aryankarma29_db_user:iR1609zqHSZRxUDx@cluster0.fi6wvqa.mongodb.net/geeta-ecom';

async function check() {
  try {
    await mongoose.connect(MURI);
    console.log('Connected');

    // Define a minimal schema for check
    const ProductSchema = new mongoose.Schema({
        productName: String,
        category: mongoose.Schema.Types.ObjectId,
        subcategory: mongoose.Schema.Types.ObjectId
    });
    const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

    const count = await Product.countDocuments({ productName: { $regex: /file/i } });
    console.log(`\nFound ${count} products with 'file' in name.`);

    const samples = await Product.find({ productName: { $regex: /file/i } })
      .limit(10);

    console.log('\nSample Files in DB:');
    samples.forEach(s => {
      console.log(`- ${s.productName} (Cat: ${s.category}, Subcat: ${s.subcategory})`);
    });

    // Check for "Document files" category match
    const docFilesId = '69cac7cf3583bdff6a6a895e';
    const catCount = await Product.countDocuments({
        $or: [
            { category: new mongoose.Types.ObjectId(docFilesId) },
            { subcategory: new mongoose.Types.ObjectId(docFilesId) }
        ]
    });
    console.log(`\nFound ${catCount} products matching 'Document files' ID (${docFilesId})`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
