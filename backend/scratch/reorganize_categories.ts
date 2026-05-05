import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Category from '../src/models/Category';
import Product from '../src/models/Product';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MAPPING: Record<string, string[]> = {
  "Baby & Kids": [
    "BABY CARE", "BABY BELT", "BABY BIKE & CAR", "BABY CHAIR", "BABY PALNE", 
    "BABY SOCKS", "BABY WAKAR", "TOYS", "TEDDY BEAR"
  ],
  "Personal Care & Hygiene": [
    "COSMATIC & BEAUTY, PERFUME,", "BEAUTY & HYGIENE", "COMB & KANGHE", 
    "HAIR SPRAY", "HEALTH. & DAILY ROUTINE", "SURGICAL PRODUCT"
  ],
  "Home & Kitchen": [
    "KITCHEN| GARDEN & PETS", "DISPOJAL PATTAL & DONA", "BUKKED & MUG BALTI OR MAGGA", 
    "WATER CAN OR WATER BOTTEL", "STEEL THARMASH & BOTTLE", "TABLE ROLL", 
    "HOME DECORATION", "MIRROR", "WALL WATCH", "JYOT CANDIL", "SINERY FREAM"
  ],
  "Cleaning & Household Groups": [
    "CLEANING & HOUSEHOLD", "CLEANING MATERIAL", "AIR FRESHENER & ROOM FRESHENER", 
    "MOSQUITO NET & MACHHAR DANI", "LOCK & TALA"
  ],
  "Fashion & Accessories": [
    "GENTS VOILET & BELT OR PURSE", "VIOLET & PURSE", "UNDER GARMENTS", 
    "SOCKS & MOJE", "CAP", "WATCH & SUNGLASSES", "TOWELS", "UMBRELLA CHATRI", 
    "BAG", "BAG & LEDIES PURSE", "SUITCASE", "RAINCOAT & RAINSUITE", "WINTER & UNI ITEMS"
  ],
  "Electronics & Gadgets": [
    "COMPUTER ACCESSORIES", "ELECTRONIC", "TOURCH & BATTERY", "SPEAKER", 
    "PEN DRIVE", "TRIMMER,DRYER,STRAIGHTENR MACHINE"
  ],
  "Education & School": [
    "BOOK", "STATIONARY", "PRECTICAL", "COMPOSS & GEOMETRY BOX", 
    "SCHOOL BAG", "SCHOOL DRESS", "BILL BOOK LETTER PAD"
  ],
  "Special Occasions & Pujan": [
    "BIRTHDAY, WELCOME, ALL DECORATION", "DANDIYA STICK", "JHANDE", 
    "26 JANUARY REPUBLIC DAY & 15 AUGUST INDEPENDENCE DAY", 
    "VIVAH SAMAGARIY", "PUJAN SAMAGARIY"
  ],
  "Tailoring & Tools": [
    "SEVING CUTTING ITEM", "KECHHI & SCISSORS", "TAILOR MATERIAL", "SPRAY BOTTLE"
  ]
};

async function reorganize() {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const [parentName, childNames] of Object.entries(MAPPING)) {
      console.log(`\nProcessing group: ${parentName}`);
      
      const parentSlug = parentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      // 1. Find or create parent category
      let parent = await Category.findOne({ 
        $or: [
          { name: { $regex: new RegExp(`^${parentName}$`, 'i') } },
          { slug: parentSlug }
        ]
      });

      if (!parent) {
        parent = await Category.create({
          name: parentName,
          status: 'Active',
          order: 0,
          slug: parentSlug
        });
        console.log(`Created parent category: ${parentName} (${parent._id})`);
      } else {
        console.log(`Found existing category to use as parent: ${parent.name} (${parent._id})`);
        // Ensure it's a root category
        if (parent.parentId) {
          await Category.findByIdAndUpdate(parent._id, { parentId: null });
          console.log(`  Set ${parent.name} as root category`);
        }
      }

      for (const childName of childNames) {
        // Skip if child is the same as parent
        if (childName.toLowerCase() === parentName.toLowerCase()) continue;

        const child = await Category.findOne({ name: childName });
        if (!child) {
          console.log(`  ! Child not found: ${childName}`);
          continue;
        }

        // 2. Update child category to point to parent
        if (child.parentId?.toString() !== parent._id.toString()) {
           await Category.findByIdAndUpdate(child._id, { parentId: parent._id });
           console.log(`  Updated ${childName} parentId -> ${parent.name}`);
        }

        // 3. Update products
        const result = await Product.updateMany(
          { category: child._id },
          { 
            category: parent._id,
            subcategory: child._id
          }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`  Updated ${result.modifiedCount} products for ${childName}`);
        }
      }
    }

    console.log('\nReorganization complete!');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

reorganize();
