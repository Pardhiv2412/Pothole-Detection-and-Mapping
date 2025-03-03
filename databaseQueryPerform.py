import psycopg2

# Database connection configuration
db_config = {
    "host": "dpg-cupn225svqrc73f3nk1g-a.singapore-postgres.render.com",
    "database": "pothole_db_jufk",
    "user": "pothole_db_user",
    "password": "FrASueUsUotopruwjaWrDHCR0V4Q921h",
    "port": 5432,
}

# SQL query to create the pothole_data table
create_table_query = """
CREATE TABLE IF NOT EXISTS pothole_data (
    id SERIAL PRIMARY KEY,
    longitude DOUBLE PRECISION NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    severity FLOAT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

# Connect to the database and execute the query
try:
    conn = psycopg2.connect(**db_config)
    cur = conn.cursor()
    
    cur.execute("SELECT * FROM potholes")

    for row in cur.fetchall():
        print(row)

    conn.commit()
    
    cur.close()
    conn.close()
except Exception as e:
    print("Error:", e)

