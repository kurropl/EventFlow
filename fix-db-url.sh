#!/bin/bash
cd /root/eventflow
python3 << 'ENDSCRIPT'
import sys
with open('docker-compose.yml') as f:
    lines = f.readlines()
changed = False
for i, line in enumerate(lines):
    if 'postgresql://postgres:***@postgres:5432/eventflow' in line:
        lines[i] = line.replace('postgresql://postgres:***@postgres:5432/eventflow', 
                                'postgresql://postgres:postgres@postgres:5432/eventflow')
        changed = True
        print(f'Fixed line {i+1}')
    if 'GOTRUE_DB_DATABASE_URL: postgres://postgres:***@postgres:5432/postgres' in line:
        lines[i] = line.replace('GOTRUE_DB_DATABASE_URL: postgres://postgres:***@postgres:5432/postgres',
                                'GOTRUE_DB_DATABASE_URL: postgres://postgres:postgres@postgres:5432/postgres')
        changed = True
        print(f'Fixed gotrue line {i+1}')
if not changed:
    print('No changes needed')
    sys.exit(0)
with open('docker-compose.yml', 'w') as f:
    f.writelines(lines)
print('Written OK')
ENDSCRIPT
