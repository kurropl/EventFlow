-- Force MD5 encryption for all future password changes
ALTER SYSTEM SET password_encryption = 'md5';
SELECT pg_reload_conf();
ALTER USER postgres WITH PASSWORD 'postgres';