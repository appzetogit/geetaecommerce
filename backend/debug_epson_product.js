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
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    value: String,
    title: String,
    pack: String,
    stock: Number,
    price: Number,
    discPrice: Number,
    sku: String
  }]
}, { collection: 'products' });

const Product = mongoose.model('Product', ProductSchema);

async function debugEpsonProduct() {
  try {
    console.log('\n=== Searching for Epson products ===\n');

    // Find products with "epson" in the name
    const products = await Product.find({
      productName: /epson/i
    });

    console.log(`Found ${products.length} Epson products\n`);

    products.forEach((product, index) => {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Product ${index + 1}: ${product.productName}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Product ID: ${product._id}`);
      console.log(`Top-level stock: ${product.stock}`);
      console.log(`Number of variations: ${product.variations?.length || 0}`);

      if (product.variations && product.variations.length > 0) {
        console.log('\nVariations:');
        product.variations.forEach((v, i) => {
          console.log(`\n  Variation ${i + 1}:`);
          console.log(`    _id: ${v._id}`);
          console.log(`    name: "${v.name}"`);
          console.log(`    value: "${v.value}"`);
          console.log(`    title: "${v.title || 'N/A'}"`);
          console.log(`    pack: "${v.pack || 'N/A'}"`);
          console.log(`    stock: ${v.stock}`);
          console.log(`    price: ${v.price}`);
          console.log(`    discPrice: ${v.discPrice || 'N/A'}`);
          console.log(`    sku: ${v.sku || 'N/A'}`);

          // Check if this matches "Piece"
          const matchesPiece = /piece/i.test(v.name) ||
                              /piece/i.test(v.value) ||
                              /piece/i.test(v.title) ||
                              /piece/i.test(v.pack);
          if (matchesPiece) {
            console.log(`    ⚠️  MATCHES "Piece" - Stock: ${v.stock}`);
          }
        });
      } else {
        console.log('\n  No variations found');
      }
    });

    // Check for products with "Piece" variation specifically
    console.log('\n\n' + '='.repeat(80));
    console.log('CHECKING FOR "Piece" VARIATION MATCH');
    console.log('='.repeat(80));

    products.forEach(product => {
      if (product.variations && product.variations.length > 0) {
        const pieceVariation = product.variations.find(v => {
          const vName = (v.name || '').toLowerCase().trim();
          const vValue = (v.value || '').toLowerCase().trim();
          const vTitle = (v.title || '').toLowerCase().trim();
          const vPack = (v.pack || '').toLowerCase().trim();

          return vName === 'piece' ||
                 vValue === 'piece' ||
                 vTitle === 'piece' ||
                 vPack === 'piece';
        });

        if (pieceVariation) {
          console.log(`\n✓ ${product.productName} (${product._id})`);
          console.log(`  Has exact "Piece" match in: ${
            pieceVariation.name?.toLowerCase() === 'piece' ? 'name' :
            pieceVariation.value?.toLowerCase() === 'piece' ? 'value' :
            pieceVariation.title?.toLowerCase() === 'piece' ? 'title' : 'pack'
          }`);
          console.log(`  Stock: ${pieceVariation.stock}`);
          console.log(`  ${pieceVariation.stock > 0 ? '✓ IN STOCK' : '✗ OUT OF STOCK'}`);
        }
      }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n\nConnection closed');
  }
}

debugEpsonProduct();
