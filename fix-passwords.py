with open('/root/eventflow/docker-compose.yml', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'DATABASE_URL=postgresql' in line:
        lines[i] = '      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/eventflow\n'
    elif 'GOTRUE_DB_DATABASE_URL:' in line:
        lines[i] = '      GOTRUE_DB_DATABASE_URL: postgres://postgres:postgres@postgres:5432/postgres\n'
    elif 'PGRST_DB_URI:' in line:
        lines[i] = '      PGRST_DB_URI: postgres://postgres:postgres@postgres:5432/postgres\n'

with open('/root/eventflow/docker-compose.yml', 'w') as f:
    f.writelines(lines)

print('Fixed all DB passwords')
