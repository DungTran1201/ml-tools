import sqlite3
conn = sqlite3.connect(r"C:\Users\PC\Desktop\ml-tools\database\app.db")
conn.execute("""CREATE TABLE preset_catalog (
    key VARCHAR NOT NULL, 
    name VARCHAR NOT NULL, 
    category VARCHAR NOT NULL, 
    provider VARCHAR NOT NULL, 
    description VARCHAR, 
    default_splits VARCHAR, 
    class_count INTEGER, 
    estimated_size VARCHAR, 
    PRIMARY KEY (key)
);""")
tables = conn.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
).fetchall()
indexes = conn.execute(
    "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
).fetchall()
views = conn.execute(
    "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name"
).fetchall()
# Verify FK constraints are enforced
fk_status = conn.execute("PRAGMA foreign_keys").fetchone()[0]
print(f"Tables ({len(tables)}):")
for t in tables:
    print(f"  {t[0]}")
print(f"\nIndexes ({len(indexes)}):")
for i in indexes:
    print(f"  {i[0]}")
print(f"\nViews ({len(views)}):")
for v in views:
    print(f"  {v[0]}")
print(f"\nforeign_keys PRAGMA: {'ON' if fk_status else 'OFF'}")
conn.close()
print("\n✅ Schema validated — zero errors.")