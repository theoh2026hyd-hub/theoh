-- Run in Supabase SQL Editor, then optionally: node migration_add_addon_calories.js

ALTER TABLE product_addons ADD COLUMN IF NOT EXISTS calories DECIMAL(10, 2);

UPDATE product_addons SET calories = 52 WHERE name = 'Apple';
UPDATE product_addons SET calories = 89 WHERE name = 'Banana';
UPDATE product_addons SET calories = 43 WHERE name = 'Blackberry';
UPDATE product_addons SET calories = 60 WHERE name = 'Dragon Fruit';
UPDATE product_addons SET calories = 69 WHERE name = 'Grapes';
UPDATE product_addons SET calories = 60 WHERE name = 'Mango (Seasonal)';
UPDATE product_addons SET calories = 34 WHERE name = 'Muskmelon';
UPDATE product_addons SET calories = 43 WHERE name = 'Mulberries';
UPDATE product_addons SET calories = 83 WHERE name = 'Pomegranate';
UPDATE product_addons SET calories = 52 WHERE name = 'Raspberries';
UPDATE product_addons SET calories = 32 WHERE name = 'Strawberries';
UPDATE product_addons SET calories = 580 WHERE name = 'All Mix Nuts';
UPDATE product_addons SET calories = 579 WHERE name = 'Almonds';
UPDATE product_addons SET calories = 299 WHERE name = 'Black Raisins';
UPDATE product_addons SET calories = 553 WHERE name = 'Cashews';
UPDATE product_addons SET calories = 308 WHERE name = 'Cranberries';
UPDATE product_addons SET calories = 282 WHERE name = 'Dates';
UPDATE product_addons SET calories = 299 WHERE name = 'Green Raisins';
UPDATE product_addons SET calories = 628 WHERE name = 'Hazelnuts';
UPDATE product_addons SET calories = 567 WHERE name = 'Peanuts';
UPDATE product_addons SET calories = 654 WHERE name = 'Walnuts';
UPDATE product_addons SET calories = 486 WHERE name = 'Chia Seeds';
UPDATE product_addons SET calories = 559 WHERE name = 'Pumpkin Seeds';
UPDATE product_addons SET calories = 584 WHERE name = 'Sunflower Seeds';
UPDATE product_addons SET calories = 557 WHERE name = 'Watermelon Seeds';
