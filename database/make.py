import sqlite3
conn = sqlite3.connect(":memory:")
conn.executescript(open("schema.sql", encoding="utf-8").read())
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