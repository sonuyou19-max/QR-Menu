-- Step 14 (PDF upload): menus from a designer or print shop are often bigger than a phone photo.
-- The menu-uploads bucket already accepts application/pdf; raise its size limit from 5 to 10 MB.
-- (Photos are compressed in the browser to well under 1 MB, so this only matters for PDFs.)
update storage.buckets set file_size_limit = 10485760 where id = 'menu-uploads';
