
import React, { useState, useEffect, useMemo } from 'react';

interface Unit {
  name: string;
  code: string;
}

interface UnitSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (unit: string) => void;
  currentValue?: string;
}

const ALL_UNITS: Unit[] = [
    { name: "None", code: "" },
    { name: "Bags", code: "bag" },
    { name: "Bale", code: "bal" },
    { name: "Billions of Units", code: "bou" },
    { name: "Bottles", code: "btl" },
    { name: "Box", code: "box" },
    { name: "Buckles", code: "bkl" },
    { name: "Bunches", code: "bun" },
    { name: "Bundles", code: "bdl" },
    { name: "Cans", code: "can" },
    { name: "Cartons", code: "ctn" },
    { name: "Centimeter", code: "cms" },
    { name: "Cubic Centimeter", code: "ccm" },
    { name: "Cubic Meter", code: "cbm" },
    { name: "Dozen", code: "doz" },
    { name: "Drum", code: "drm" },
    { name: "Grams", code: "gms" },
    { name: "Gross", code: "grs" },
    { name: "Gross Yards", code: "gyd" },
    { name: "Kilogram", code: "kgs" },
    { name: "Litre", code: "ltr" },
    { name: "Meters", code: "mtr" },
    { name: "Milliliter", code: "mlt" },
    { name: "Numbers", code: "nos" },
    { name: "Packs", code: "pac" },
    { name: "Pairs", code: "prs" },
    { name: "Pieces", code: "pcs" },
    { name: "Quintal", code: "qtl" },
    { name: "Rolls", code: "rol" },
    { name: "Sets", code: "set" },
    { name: "Square Feet", code: "sqf" },
    { name: "Square Meters", code: "sqm" },
    { name: "Square Yards", code: "sqy" },
    { name: "Tablets", code: "tbs" },
    { name: "Ten Gross", code: "tgm" },
    { name: "Thousands", code: "thd" },
    { name: "Tonnes", code: "ton" },
    { name: "Tubes", code: "tub" },
    { name: "Units", code: "unt" },
    { name: "Us Gallons", code: "ugs" },
    { name: "Yards", code: "yds" },
    { name: "Strips", code: "strp" },
    { name: "Acre", code: "acre" },
    { name: "Hours", code: "hrs" },
    { name: "mins", code: "mins" },
    { name: "plates", code: "plates" },
    { name: "glasses", code: "glasses" },
    { name: "strips", code: "strips" },
    { name: "vials", code: "vials" },
    { name: "bags", code: "bags" },
    { name: "bundles", code: "bundles" },
    { name: "cans", code: "cans" },
    { name: "cartons", code: "cartons" },
    { name: "dozen", code: "dozen" },
    { name: "inches", code: "inches" },
    { name: "feet", code: "feet" },
    { name: "pouch", code: "pouch" },
    { name: "bora", code: "bora" },
    { name: "Day", code: "day" },
    { name: "Month", code: "month" },
];

const POPULAR_UNITS = [
    { name: "Pieces", code: "pcs" },
    { name: "Kilogram", code: "kgs" },
    { name: "Grams", code: "gms" },
    { name: "Litre", code: "ltr" },
    { name: "Dozen", code: "doz" },
    { name: "Packs", code: "pac" },
];

const RECENT_UNITS_KEY = 'recent_units';

export default function UnitSelectionModal({
  isOpen,
  onClose,
  onSelect,
  currentValue
}: UnitSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [recentUnits, setRecentUnits] = useState<Unit[]>([]);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem(RECENT_UNITS_KEY);
      if (saved) {
        try {
          setRecentUnits(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse recent units", e);
        }
      }
    }
  }, [isOpen]);

  const filteredUnits = useMemo(() => {
    if (!searchTerm) return ALL_UNITS;
    const lowerSearch = searchTerm.toLowerCase();
    return ALL_UNITS.filter(
      unit =>
        unit.name.toLowerCase().includes(lowerSearch) ||
        unit.code.toLowerCase().includes(lowerSearch)
    );
  }, [searchTerm]);

  const handleSelect = (unit: Unit) => {
    // Add to recent
    const newRecent = [unit, ...recentUnits.filter(u => u.code !== unit.code)].slice(0, 5);
    setRecentUnits(newRecent);
    localStorage.setItem(RECENT_UNITS_KEY, JSON.stringify(newRecent));

    onSelect(`${unit.code}`); // Pass only the code as value, or maybe name if preferred. User input was "1kg", so maybe they want code.
                             // Actually user image shows "1kg", so input probably expects value + unit.
                             // Wait, the field is "Pack / Unit Size (e.g. 1 kg, 500 ml, 1 pc)".
                             // The image shows a list of just "Grams", "Kilogram".
                             // If I select "Grams", does it fill "gms" or "Grams"?
                             // In the input it says "1kg".
                             // Likely the user types the number and selects the unit?
                             // OR the input is just the unit string?
                             // LOOKING CLOSELY AT IMAGE 1: "Pack / Unit Size ... 1kg" is typed.
                             // Image 2 title: "Measuring Units".
                             // Image 2 search: "Search by unit's name".
                             // Image 2 selections: "Grams", "Kilogram" etc.
                             // Image 5 shows "Packs pac", "Pairs prs".
                             // It seems this modal is for selecting the UNIT part.
                             // The user request says: "click karne par ... options aane chahiye and isko apan select kar sake".
                             // If I select "Grams", should it replace the whole text with "grams" or "gms"?
                             // Usually "Pack / Unit Size" implies the whole string like "1 kg".
                             // If this modal is just for the UNIT, then the flow might be: User enters "1", then selects "kg".
                             // BUT the request says "click PAR open hoga".
                             // Converting "1kg" to separate fields is too big a change?
                             // Maybe I should just append the unit code or replace the text?
                             // The screenshot 5 has checks.
                             // Let's assume selecting a unit returns its code (e.g. 'gms', 'kgs') or name.
                             // Given the backend field is `pack`, which is a string.
                             // If I select "Grams", it probably should just set the value to "gms" or "Grams".
                             // But wait, "1 kg" implies Quantity + Unit.
                             // If I just select "Kilogram", do I get "1 kg"? No.
                             // Maybe this modal is ONLY to help pick the unit text?
                             // If I click it, it opens. I select "Kilogram". Input becomes "Kilogram"? Or "kgs"?
                             // Image 5 shows "Grams   gms  (checked)".
                             // This implies selecting "Grams" gives "gms".
                             // Let's assume it sets the value to the unit code (or name).
                             // If the user wants "1 kgs", they might need to type "1 " then select?
                             // OR the input is JUST the unit?
                             // Label says "Pack / Unit Size (e.g. 1 kg...)".
                             // If I select "Kilogram", it might just insert "kgs".
                             // I will treat it as: Click -> Open Modal -> Select Unit -> Input value becomes "kgs".
                             // User might have to type "1 " before or after?
                             // Or maybe the input should allow typing "1 " and then triggering modal?
                             // But simplistic approach: Text input is readOnly (as per "click par web view... options aane chahiye").
                             // If text input is readOnly, user CANNOT type "1".
                             // So maybe the modal should allow entering quantity too?
                             // OR maybe the user just wants to select "kgs" and "1" is assumed or separate?
                             // In the first image, "1kg" is entered.
                             // If I make it readOnly, they can't type "1".
                             // Maybe the request implies: "Give me this list to SELECT FROM".
                             // If I select "Kilogram", maybe it creates "1 kgs"?
                             // Or maybe the input should NOT be readOnly, but contain a button to open modal?
                             // Request: "isko click karne par... options aane chahiye... isko apan select kar sake".
                             // If I click the input, it opens.
                             // If I want to type "500 ml", how do I do it if clicking opens modal?
                             // Maybe I should append the selected unit to the existing text?
                             // Or maybe I should add a small button NEXT to the input to open this unit picker?
                             // "isko click karne par" implies the input itself.
                             // If I implement exactly as requested, clicking input opens modal.
                             // Then I can't type numbers.
                             // Unless the modal HAS a number input? The images don't show a number input.
                             // Maybe the "Pack / Unit Size" field is SUPPOSED to be just the unit in their new flow?
                             // But the placeholder says "e.g. 1 kg".
                             // PROBABLY: The input remains editable, but clicking (or maybe a specific icon) opens the modal.
                             // OR, clicking opens modal, you pick "Grams", and it inserts "gms". Then you can edit?
                             // If clicking ALWAYS opens modal, you can't edit.
                             // I will make the input *have an icon* to open the modal, OR make the whole thing a custom selector if they only want unit.
                             // BUT "1kg" is a value + unit.
                             // Let's look at the images again.
                             // Image 2, 3, 4, 5 are from a mobile app (looks like). "Measuring Units".
                             // It seems they want to replace the free text "Pack Size" with a Unit Selector?
                             // If so, where does the quantity go?
                             // Maybe "Variation" handles quantity/price, and this "Pack/Unit Size" is just the "Unit"?
                             // In the screenshot 1: "Pack / Unit Size ... 1kg".
                             // If I change this to just "kgs", then it's just a unit.
                             // I will proceed with creating the modal selector.
                             // On selection, I will simply call `onSelect(unit.code)`.
                             // I will NOT make the input readOnly, but maybe add a button or icon specific for "Select Unit" inside the input wrapper, OR just make the focus event trigger it?
                             // If `onFocus` triggers it, it's annoying if you want to type.
                             // Let's look at the phrasing: "isko click karne par ... options aane chahiye".
                             // "same as it is" (referring to images).
                             // The images show a pure list selection.
                             // I suspect they want the field to become a Unit *Dropdown* essentially.
                             // But if the backend expects "1 kg", sending "kgs" might be wrong if the user intended "1 kg".
                             // However, I must follow the user's "click -> options" request.
                             // I'll make the input `readOnly` and open the modal on click.
                             // This means the user can ONLY select a unit (e.g. "kgs").
                             // If they need "1 kg", they might have to rely on `quantity` somewhere else?
                             // Or maybe I should add a quantity input IN the modal?
                             // The provided images DO NOT show a quantity input.
                             // I will stick to what is shown: A list of units.
                             // If this breaks "1 kg" vs "500 g" distinction (if no other quantity field exists), that's a constraint of the request.
                             // Wait, there is `Variation` section which has "Unit Value" (e.g. XL, 1kg).
                             // The field in question is "Pack / Unit Size" in product details.
                             // Maybe this is just the base unit?
                             // I'll implement the modal to return the unit code.

                             // COMPROMISE: I will adding a small "list" icon button inside the input (right side).
                             // Clicking the INPUT or the ICON opens the modal.
                             // If I make input read-only, it's safe.
                             // If I leave it editable, typing `1` triggers modal?
                             // I'll make it readOnly to match "click -> open" behavior perfectly, assuming they just want to pick a unit.

                             // Actually, looking at image 1: "Pack / Unit Size (e.g. 1 kg, 500 ml, 1 pc)".
                             // If I pick "Kilogram", it puts "kgs".
                             // If the user wants "5 kgs", they are stuck.
                             // EXCEPT: If I look at image 5, it just selects "gms".

                             // Let's implement the modal.
                             // I will pass `unit.code` to the parent.

    onSelect(unit.code);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-md h-[80vh] sm:h-auto sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col animate-slide-up sm:animate-none overflow-hidden">
        {/* Header */}
        <div className="flex flex-col border-b border-gray-100 pb-2">
            <div className="self-center mt-2 w-12 h-1 bg-gray-200 rounded-full sm:hidden"></div>
            <div className="flex justify-between items-center px-4 py-3">
            <h3 className="text-lg font-bold text-gray-800">Measuring Units</h3>
            <button
                onClick={onClose}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            </div>

            {/* Search */}
            <div className="px-4 pb-2">
                <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <input
                        type="text"
                        placeholder="Search by unit's name"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-full border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-sm outline-none"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {!searchTerm && recentUnits.length > 0 && (
                <div>
                     <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Recently used
                     </h4>
                     <div className="flex flex-wrap gap-2">
                         {recentUnits.map(unit => (
                            <button
                                key={unit.code}
                                onClick={() => handleSelect(unit)}
                                className="px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                                {unit.name}
                            </button>
                         ))}
                     </div>
                </div>
            )}

            {!searchTerm && (
                <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path></svg>
                        Popular units
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {POPULAR_UNITS.map(unit => (
                            <button
                                key={unit.code}
                                onClick={() => handleSelect(unit)}
                                className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${currentValue === unit.code ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50'}`}
                            >
                                {unit.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Select Unit
                </h4>
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    {filteredUnits.length > 0 ? filteredUnits.map((unit, index) => (
                        <button
                            key={unit.code}
                            onClick={() => handleSelect(unit)}
                            className={`w-full text-left px-4 py-3.5 flex justify-between items-center transition-colors ${index !== filteredUnits.length - 1 ? 'border-b border-gray-50' : ''} ${currentValue === unit.code ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                        >
                            <span className={`font-medium ${currentValue === unit.code ? 'text-blue-700' : 'text-blue-900'}`}>{unit.name}</span>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-400 font-medium lowercase">{unit.code}</span>
                                {currentValue === unit.code && (
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                )}
                            </div>
                        </button>
                    )) : (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            No units found
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
