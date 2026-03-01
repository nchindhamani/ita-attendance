-- Drop is_archived from students if it exists
alter table if exists students
  drop column if exists is_archived;




