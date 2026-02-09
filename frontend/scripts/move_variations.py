import os

file_path = r"c:/Users/payal/Downloads/geetaecommerce/frontend/src/modules/seller/pages/SellerAddProduct.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# 1-based line numbers from view_file
start_line = 1382
end_line = 1871
target_line_original = 2161

# Convert to 0-based indices
start_idx = start_line - 1
end_idx = end_line - 1
target_idx_original = target_line_original - 1

# Verification output
print(f"Verifying lines to move:")
print(f"Line {start_line}: {lines[start_idx].strip()}")
print(f"Line {end_line}: {lines[end_idx].strip()}")
# Check if start line looks like the variations section
if "Product Variations Section" not in lines[start_idx] and "Variation" not in lines[start_idx+1]:
    print("WARNING: Start line contents do not match expected 'Product Variations Section'. Aborting.")
    exit(1)

# Calculate lines removed
lines_removed_count = end_idx - start_idx + 1
print(f"Removing {lines_removed_count} lines.")

# Extract block
block_to_move = lines[start_idx : end_idx + 1]

# Remove from list
# Note: deleting a slice modifies the list in place
del lines[start_idx : end_idx + 1]

# Calculate new insertion index
# Original target index was target_idx_original.
# Since the deleted block was BEFORE the target, the target index shifts down by lines_removed_count.
new_target_idx = target_idx_original - lines_removed_count

print(f"Insertion Point Verification:")
print(f"Old Line {target_line_original} -> New Index {new_target_idx} (Line {new_target_idx + 1})")
print(f"Content at new target: {lines[new_target_idx].strip()}")

# Verify we are at the end of SEO section (closing div)
if lines[new_target_idx].strip() != "</div>":
    print("WARNING: Target line is not a closing div. Please check manually.")
    # We might proceed if it looks close enough or if we trust the offset, but let's be safe.

# Insert AFTER the target line
lines.insert(new_target_idx + 1, "\n") # Add spacer
for line in reversed(block_to_move):
    lines.insert(new_target_idx + 2, line)

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("Successfully moved Product Variations section.")
