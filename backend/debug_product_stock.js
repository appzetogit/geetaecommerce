const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/geetaecommerce')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define minimal Product schema for debugging
const ProductSchema = new mongoose.Schema({
  productName: String,
  stock: Number,
  variations: [{
    name: String,
    value: String,
    title: String,
    pack: String,
    stock: Number,
    price: Number
  }]
}, { collection: 'products' });

const Product = mongoose.model('Product', ProductSchema);

async function debugProductStock() {
  try {
    console.log('\n=== Searching for products with "Piece" variation ===\n');

    // Find products that might have "Piece" variation
    const products = await Product.find({
      $or: [
        { 'variations.value': /piece/i },
        { 'variations.name': /piece/i },
        { 'variations.title': /piece/i },
        { 'variations.pack': /piece/i }
      ]
    }).limit(10);

    console.log(`Found ${products.length} products with "Piece" variation\n`);

    products.forEach((product, index) => {
      console.log(`\n--- Product ${index + 1}: ${product.productName} ---`);
      console.log(`Product ID: ${product._id}`);
      console.log(`Top-level stock: ${product.stock}`);
      console.log(`Variations (${product.variations?.length || 0}):`);

      if (product.variations && product.variations.length > 0) {
        product.variations.forEach((v, i) => {
          console.log(`  ${i + 1}. ${JSON.stringify({
            _id: v._id,
            name: v.name,
            value: v.value,
            title: v.title,
            pack: v.pack,
            stock: v.stock,
            price: v.price
          }, null, 2)}`);
        });
      }
    });

    // Also check for products with low or zero stock in variations
    console.log('\n\n=== Products with zero/low stock in "Piece" variations ===\n');

    const lowStockProducts = await Product.find({
      $or: [
        { 'variations.value': /piece/i },
        { 'variations.name': /piece/i },
        { 'variations.title': /piece/i },
        { 'variations.pack': /piece/i }
      ]
    });

    lowStockProducts.forEach(product => {
      const pieceVariations = product.variations?.filter(v =>
        /piece/i.test(v.value) ||
        /piece/i.test(v.name) ||
        /piece/i.test(v.title) ||
        /piece/i.test(v.pack)
      );

      pieceVariations?.forEach(v => {
        if (v.stock === 0 || v.stock < 1) {
          console.log(`⚠️  ${product.productName} (${product._id})`);
          console.log(`   Variation: ${v.value || v.name || v.title || v.pack}`);
          console.log(`   Stock: ${v.stock}`);
          console.log('');
        }
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nConnection closed');
  }
}

debugProductStock();
