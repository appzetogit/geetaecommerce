# Seller Category Creation Feature - Frontend Only Plan

## 📋 Feature Overview
Admin panel mein ek permission toggle hoga jo seller-wise enable/disable kar sakta hai. Jab enabled ho, to seller apni khud ki categories create kar sakta hai.

---

## 🎯 Goals
1. **Admin Control**: Admin har seller ke liye individually category creation permission de/revoke kar sake
2. **Seller Flexibility**: Permission milne par seller apni categories create kar sake
3. **Seamless UX**: User ko merged categories (Admin + Seller) seamlessly dikhni chahiye
4. **Frontend Only**: Abhi sirf UI/UX implementation, backend calls mock rahenge

---

## 📂 Files to Modify

### Admin Panel
- `frontend/src/modules/admin/pages/AdminManageSellerList.tsx`

### Seller Panel
- `frontend/src/modules/seller/pages/SellerCategory.tsx` (existing - view only page)
- `frontend/src/modules/seller/pages/SellerCategoryForm.tsx` (NEW - create/edit form)

### Data Storage (Temporary - Frontend Only)
- **localStorage** keys:
  - `seller_category_permissions` - Admin ki taraf se set kiye permissions
  - `seller_created_categories_{sellerId}` - Har seller ki apni categories
  - `current_seller_id` - Currently logged-in seller ka ID

---

## 🔄 Implementation Flow

### Phase 1: Admin Panel - Permission Management

#### File: `AdminManageSellerList.tsx`

**Changes Required:**

1. **State Management**
   ```typescript
   // Local state for demo - backend se aayega later
   const [sellerPermissions, setSellerPermissions] = useState<Record<string, boolean>>({});
   ```

2. **Load Permissions from localStorage**
   ```typescript
   useEffect(() => {
     const saved = localStorage.getItem('seller_category_permissions');
     if (saved) {
       setSellerPermissions(JSON.parse(saved));
     }
   }, []);
   ```

3. **Table Header - New Column**
   - Position: "Enable/Disable" ke baad, "Action" se pehle
   - Title: "Category Permission"
   - Icon: Category icon optional

4. **Table Body - Toggle Switch**
   ```typescript
   <td className="p-4 align-middle">
     <button
       onClick={() => handleToggleCategoryPermission(seller._id)}
       className={toggle switch classes}
       title={permission ? 'Can create categories' : 'Cannot create categories'}
     >
       <span className={toggle indicator}/>
     </button>
   </td>
   ```

5. **Toggle Handler Function**
   ```typescript
   const handleToggleCategoryPermission = (sellerId: string) => {
     const newPermissions = {
       ...sellerPermissions,
       [sellerId]: !sellerPermissions[sellerId]
     };
     setSellerPermissions(newPermissions);
     localStorage.setItem('seller_category_permissions', JSON.stringify(newPermissions));

     // Success toast
     showToast(`Category creation ${newPermissions[sellerId] ? 'enabled' : 'disabled'}`);
   };
   ```

6. **Visual Indicators**
   - Toggle ON: Pink color (`bg-[#f187b5]`)
   - Toggle OFF: Gray color (`bg-gray-200`)
   - Tooltip on hover showing current status

**UI/UX Details:**
- Table width adjust hoga to accommodate new column
- Mobile responsive: Column scrollable horizontally
- Toggle animation smooth rahega
- Success message show hoga bottom-right toast mein

---

### Phase 2: Seller Panel - Category List Page Enhancement

#### File: `SellerCategory.tsx`

**Changes Required:**

1. **State Management**
   ```typescript
   const [canCreateCategories, setCanCreateCategories] = useState(false);
   const [isAddModalOpen, setIsAddModalOpen] = useState(false);
   const [ownCategories, setOwnCategories] = useState<Category[]>([]);
   ```

2. **Check Permission on Mount**
   ```typescript
   useEffect(() => {
     const currentSellerId = localStorage.getItem('current_seller_id');
     const permissions = localStorage.getItem('seller_category_permissions');

     if (currentSellerId && permissions) {
       const parsed = JSON.parse(permissions);
       setCanCreateCategories(parsed[currentSellerId] || false);
     }

     // Load own categories
     const ownCats = localStorage.getItem(`seller_created_categories_${currentSellerId}`);
     if (ownCats) {
       setOwnCategories(JSON.parse(ownCats));
     }
   }, []);
   ```

3. **Merge Categories Display**
   ```typescript
   const allCategories = [
     ...categories.map(c => ({ ...c, source: 'admin', editable: false })),
     ...ownCategories.map(c => ({ ...c, source: 'seller', editable: true }))
   ];
   ```

4. **UI Components to Add**

   **a) Permission Status Banner (if disabled)**
   ```jsx
   {!canCreateCategories && (
     <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
       <div className="flex">
         <div className="flex-shrink-0">
           <InfoIcon className="h-5 w-5 text-yellow-400" />
         </div>
         <div className="ml-3">
           <p className="text-sm text-yellow-700">
             You can only view categories. Contact admin to enable category creation.
           </p>
         </div>
       </div>
     </div>
   )}
   ```

   **b) "Add New Category" Button (conditional)**
   - Position: Export CSV button ke baad
   - Visibility: Only if `canCreateCategories === true`
   ```jsx
   {canCreateCategories && (
     <button
       onClick={() => setIsAddModalOpen(true)}
       className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
     >
       <PlusIcon /> Add New Category
     </button>
   )}
   ```

5. **Table Updates**

   **a) New Column: "Source" (optional - for clarity)**
   - Shows "Admin" or "My Category"
   - Badge style different colors

   **b) New Column: "Actions" (conditional)**
   - Visible only for own categories
   - Edit button
   - Delete button

   **Table Row Example:**
   ```jsx
   <td>
     {category.source === 'admin' ? (
       <span className="badge bg-blue-100 text-blue-800">Admin</span>
     ) : (
       <span className="badge bg-green-100 text-green-800">My Category</span>
     )}
   </td>
   <td>
     {category.editable && (
       <div className="flex gap-2">
         <button onClick={() => handleEdit(category)}>Edit</button>
         <button onClick={() => handleDelete(category)}>Delete</button>
       </div>
     )}
   </td>
   ```

**Visual Design:**
- Admin categories: Read-only, slight gray background on hover
- Seller categories: Editable, green accent on hover
- Clear visual distinction using badges/icons

---

### Phase 3: Seller Panel - Category Creation Form

#### File: `SellerCategoryForm.tsx` (NEW)

**Purpose:** Modal/Page for creating and editing seller categories

**Component Structure:**

```typescript
interface SellerCategoryFormProps {
  isOpen: boolean;
  onClose: () => void;
  editingCategory?: Category | null;
  onSave: (category: Category) => void;
}

export default function SellerCategoryForm({ isOpen, onClose, editingCategory, onSave }: SellerCategoryFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    image: '',
    description: ''
  });

  const [imagePreview, setImagePreview] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form validation
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Category name is required';
    }

    if (!formData.image) {
      newErrors.image = 'Category image is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const newCategory: Category = {
      _id: editingCategory?._id || `seller_${Date.now()}`,
      name: formData.name,
      image: formData.image,
      description: formData.description,
      totalSubcategory: 0,
      createdBy: 'seller',
      createdAt: new Date().toISOString()
    };

    onSave(newCategory);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {/* Category Name */}
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Category Name"
          className={errors.name ? 'error' : ''}
        />
        {errors.name && <span className="error-text">{errors.name}</span>}

        {/* Image Upload */}
        <div>
          <label>Category Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
          />
          {imagePreview && <img src={imagePreview} alt="Preview" />}
        </div>

        {/* Description */}
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Description (optional)"
        />

        {/* Buttons */}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">
            {editingCategory ? 'Update' : 'Create'} Category
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

**Form Fields:**
1. **Category Name** (required)
   - Input type: text
   - Validation: Not empty, max 50 chars
   - Error message red color

2. **Category Image** (required)
   - Input type: file
   - Accepted: jpg, png, webp
   - Preview shown immediately
   - Store as base64 in localStorage for demo

3. **Description** (optional)
   - Input type: textarea
   - Max 200 chars

**Save Functionality:**
```typescript
const handleSave = (category: Category) => {
  const currentSellerId = localStorage.getItem('current_seller_id');
  const key = `seller_created_categories_${currentSellerId}`;

  const existing = JSON.parse(localStorage.getItem(key) || '[]');

  if (category._id.startsWith('seller_')) {
    // New category
    existing.push(category);
  } else {
    // Edit existing
    const index = existing.findIndex(c => c._id === category._id);
    existing[index] = category;
  }

  localStorage.setItem(key, JSON.stringify(existing));

  // Refresh list
  setOwnCategories(existing);
  showToast('Category saved successfully!');
};
```

**Delete Functionality:**
```typescript
const handleDelete = (categoryId: string) => {
  if (!confirm('Are you sure you want to delete this category?')) return;

  const currentSellerId = localStorage.getItem('current_seller_id');
  const key = `seller_created_categories_${currentSellerId}`;

  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  const updated = existing.filter(c => c._id !== categoryId);

  localStorage.setItem(key, JSON.stringify(updated));
  setOwnCategories(updated);
  showToast('Category deleted successfully!');
};
```

---

### Phase 4: User-Facing App - Merged Categories

#### Files to Check/Update:
- `frontend/src/modules/user/Home.tsx` (or wherever categories are displayed)
- Any category listing/filter components

**Changes Required:**

1. **Fetch and Merge Categories**
   ```typescript
   const getAllCategories = () => {
     // Admin categories (from API - currently)
     const adminCategories = categories; // existing state

     // Seller categories (from localStorage - for demo)
     const allSellerCategories: Category[] = [];

     // Get all seller IDs who have permission
     const permissions = JSON.parse(localStorage.getItem('seller_category_permissions') || '{}');

     Object.keys(permissions).forEach(sellerId => {
       if (permissions[sellerId]) {
         const sellerCats = JSON.parse(
           localStorage.getItem(`seller_created_categories_${sellerId}`) || '[]'
         );
         allSellerCategories.push(...sellerCats);
       }
     });

     // Merge and return
     return [...adminCategories, ...allSellerCategories];
   };
   ```

2. **Display Logic**
   - No visual distinction needed on user side
   - All categories treated equally
   - Seller categories also clickable and functional

3. **Filtering/Sorting**
   - Works same as before
   - No special handling for seller vs admin categories

---

## 🎨 Design & Styling

### Color Scheme
- **Admin Categories**: Blue accent (`#3B82F6`)
- **Seller Categories**: Green accent (`#10B981`)
- **Permission Toggle ON**: Pink (`#f187b5`)
- **Permission Toggle OFF**: Gray (`#D1D5DB`)

### Icons
- **Add Category**: Plus icon (✓)
- **Edit**: Pencil icon (✏️)
- **Delete**: Trash icon (🗑️)
- **Category**: Folder/Grid icon (📁)
- **Permission**: Key or Lock icon (🔑)

### Responsive Design
- **Desktop**: Full table with all columns
- **Tablet**: Horizontal scroll for table
- **Mobile**: Card layout instead of table

---

## 📊 Data Structure

### localStorage Keys & Values

**1. Seller Permissions**
```json
// Key: 'seller_category_permissions'
{
  "seller_id_1": true,
  "seller_id_2": false,
  "seller_id_3": true
}
```

**2. Seller Created Categories**
```json
// Key: 'seller_created_categories_{sellerId}'
[
  {
    "_id": "seller_1708012345678",
    "name": "Electronics",
    "image": "data:image/png;base64,...",
    "description": "Electronic items",
    "totalSubcategory": 0,
    "createdBy": "seller",
    "createdAt": "2024-02-16T10:30:00.000Z"
  }
]
```

**3. Current Seller ID**
```json
// Key: 'current_seller_id'
"seller_id_1"
```

---

## ✅ Testing Checklist

### Admin Panel Tests
- [ ] Toggle category permission ON for a seller
- [ ] Toggle category permission OFF for a seller
- [ ] Check localStorage updates correctly
- [ ] Verify success toast appears
- [ ] Test with multiple sellers simultaneously
- [ ] Refresh page and verify state persists

### Seller Panel Tests
- [ ] Login as seller with permission ENABLED
  - [ ] "Add Category" button visible
  - [ ] Can create new category
  - [ ] Can edit own category
  - [ ] Can delete own category
  - [ ] Cannot edit admin categories
- [ ] Login as seller with permission DISABLED
  - [ ] "Add Category" button NOT visible
  - [ ] Info banner showing restricted access
  - [ ] Can only view categories
- [ ] Form validation works
  - [ ] Empty name shows error
  - [ ] Empty image shows error
  - [ ] Description optional
- [ ] Image upload and preview works
- [ ] Categories persist after page refresh

### User App Tests
- [ ] Admin categories visible
- [ ] Seller categories visible (when enabled)
- [ ] Merged list displays correctly
- [ ] Clicking category works properly
- [ ] No visual bugs or layout issues

---

## 🚀 Implementation Steps (Sequential)

### Step 1: Admin Panel - Toggle Column
**Estimate:** 30 mins
1. Add state for permissions
2. Add table column header
3. Add toggle in table body
4. Implement toggle handler
5. localStorage integration
6. Test toggle functionality

### Step 2: Seller Panel - Permission Check
**Estimate:** 20 mins
1. Add permission check on mount
2. Add state for canCreateCategories
3. Show/hide "Add Category" button
4. Add info banner for disabled state
5. Test both enabled/disabled states

### Step 3: Seller Panel - Category Form
**Estimate:** 45 mins
1. Create SellerCategoryForm.tsx
2. Build form with all fields
3. Add validation logic
4. Implement save to localStorage
5. Add image upload handler
6. Test create flow

### Step 4: Seller Panel - Edit/Delete
**Estimate:** 30 mins
1. Add edit button to own categories
2. Add delete button to own categories
3. Implement edit handler (populate form)
4. Implement delete handler with confirmation
5. Test edit and delete flows

### Step 5: Seller Panel - Category List Updates
**Estimate:** 25 mins
1. Merge admin + own categories
2. Add "Source" badge column
3. Add "Actions" column (conditional)
4. Style differentiation for admin vs seller
5. Test merged display

### Step 6: User App - Merged Categories
**Estimate:** 20 mins
1. Update category fetch logic
2. Merge admin + all seller categories
3. Test display on home page
4. Verify filtering/clicking works

### Step 7: Polish & Testing
**Estimate:** 30 mins
1. Responsive design check
2. Error handling
3. Loading states
4. Animation polish
5. Cross-browser testing
6. Documentation

**Total Estimated Time:** ~3 hours

---

## 🔄 Future Backend Integration Points

When backend is ready, replace:

1. **localStorage** → API calls
   - `seller_category_permissions` → GET/PUT `/api/admin/sellers/:id/category-permission`
   - `seller_created_categories` → GET/POST/PUT/DELETE `/api/seller/categories`

2. **Permission Check** → JWT token or user session
   - `canCreateCategories` from authenticated seller object

3. **Image Upload** → File upload endpoint
   - Base64 → Multipart form data to `/api/upload`

4. **Category Merge** → Single API call
   - GET `/api/customer/categories` returns merged list from backend

---

## 📝 Notes

- **Security**: Frontend-only hai, so no real security. Backend mein proper auth lagana
- **Performance**: For demo, localStorage theek hai. Full app mein API caching use karein
- **Scalability**: 1000+ categories ke liye pagination add karein
- **UX**: Loading skeletons add karein API calls ke liye
- **Accessibility**: ARIA labels add karein toggles aur buttons mein

---

## 🎯 Success Criteria

Feature complete mana jayega jab:
1. ✅ Admin successfully toggle kar sakta category permission
2. ✅ Seller with permission successfully category create kar sakta
3. ✅ Seller without permission sirf view kar sakta
4. ✅ User app mein merged categories dikhai deti hain
5. ✅ All CRUD operations working properly
6. ✅ Data persists across page refreshes
7. ✅ No UI bugs or layout issues
8. ✅ Responsive on all screen sizes

---

**Plan Created:** 2024-02-16
**Status:** Ready for Implementation
**Type:** Frontend Only (Demo/Prototype)
