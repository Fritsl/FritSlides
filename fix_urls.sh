#!/bin/bash
# Replace old Supabase URL format with new one
sed -i 's|https://db.waaqtqxoylxvhykessnc.supabase.co|https://waaqtqxoylxvhykessnc.supabase.co|g' client/src/pages/migration-utility.tsx
sed -i 's|db.waaqtqxoylxvhykessnc.supabase.co|waaqtqxoylxvhykessnc.supabase.co|g' client/src/pages/migration-utility.tsx
