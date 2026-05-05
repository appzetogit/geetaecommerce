import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Category from '../src/models/Category';
import Product from '../src/models/Product';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function populate() {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
    await mongoose.connect(process.env.MONGODB_URI);

    const categories: any[] = await Category.find({ status: 'Active' }).lean();
    const subCategories = categories.filter(c => c.parentId);

    // Create a map of ParentID -> [SubCategories]
    const hierarchy: Record<string, any[]> = {};
    subCategories.forEach(sub => {
      const pId = sub.parentId!.toString();
      if (!hierarchy[pId]) hierarchy[pId] = [];
      hierarchy[pId].push(sub);
    });

    const products: any[] = await Product.find({ 
      status: 'Active', 
      publish: true 
    }).select('productName category subcategory').lean();

    console.log(`Processing ${products.length} products...`);

    const updates: any[] = [];

    for (const product of products) {
      if (!product.category) continue;
      
      const parentId = product.category.toString();
      const possibleSubs = hierarchy[parentId];

      if (possibleSubs && possibleSubs.length > 0) {
        let bestMatch = null;
        const name = product.productName.toLowerCase();

        for (const sub of possibleSubs) {
          const subName = sub.name.toLowerCase();
          const keywords = subName.split(/[\s,&]+/).filter((k: string) => k.length > 2);
          
          if (name.includes(subName)) {
            bestMatch = sub;
            break;
          }

          if (keywords.length > 0 && keywords.every((k: string) => name.includes(k))) {
            bestMatch = sub;
            break;
          }
        }

        if (bestMatch && (!product.subcategory || product.subcategory.toString() !== bestMatch._id.toString())) {
          updates.push({
            id: product._id,
            subcategory: bestMatch._id
          });
        }
      }
    }

    console.log(`Found ${updates.length} products to update with subcategories.`);

    const batchSize = 100;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      await Promise.all(batch.map(u => 
        Product.findByIdAndUpdate(u.id, { subcategory: u.subcategory })
      ));
      console.log(`Updated batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(updates.length/batchSize)}`);
    }

    console.log('Population complete!');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

populate();
